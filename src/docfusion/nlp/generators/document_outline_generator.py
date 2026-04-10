#!/usr/bin/env python3
"""
Document Outline Generator

Multi-stage outline generation system that creates structured JSON outlines,
reviews and improves them, then generates compelling content with behavioral
psychology and economic bias integration.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

try:
    import aiohttp
    from aiohttp import ClientError, ClientTimeout
except ImportError:
    aiohttp = None

# Import advanced prompting strategies
from ...core.utils import uuid7str
from ..prompting_strategies import (
    AdvancedPromptBuilder,
    PromptingStrategy,
    ThoughtBranch,
    create_chain_of_thought_prompt,
    create_tree_of_thought_prompt,
    filter_thinking_tags,
)

class DocumentType(Enum):
    """Types of documents that can be outlined and generated"""

    BUSINESS_PROPOSAL = "business_proposal"
    TECHNICAL_PROPOSAL = "technical_proposal"
    RFP_RESPONSE = "rfp_response"
    PROJECT_PROPOSAL = "project_proposal"
    GRANT_PROPOSAL = "grant_proposal"
    SALES_PROPOSAL = "sales_proposal"
    RESEARCH_PROPOSAL = "research_proposal"
    CONSULTING_PROPOSAL = "consulting_proposal"
    WHITE_PAPER = "white_paper"
    BUSINESS_PLAN = "business_plan"
    STRATEGY_DOCUMENT = "strategy_document"
    TECHNICAL_SPECIFICATION = "technical_specification"

class PsychologyBias(Enum):
    """Behavioral psychology and economic biases for persuasive content"""

    # Cognitive Biases
    ANCHORING = "anchoring"  # Set reference points early
    SOCIAL_PROOF = "social_proof"  # Others are doing it
    AUTHORITY = "authority"  # Expert endorsement
    RECIPROCITY = "reciprocity"  # Give value first
    COMMITMENT = "commitment"  # Get agreement/commitment
    SCARCITY = "scarcity"  # Limited time/availability

    # Loss Aversion & Framing
    LOSS_AVERSION = "loss_aversion"  # Fear of losing vs gaining
    ENDOWMENT_EFFECT = "endowment_effect"  # Ownership feeling
    SUNK_COST = "sunk_cost"  # Already invested
    FRAMING_EFFECT = "framing_effect"  # Positive/negative framing

    # Decision Making
    AVAILABILITY_HEURISTIC = "availability_heuristic"  # Recent/memorable examples
    CONFIRMATION_BIAS = "confirmation_bias"  # Confirm existing beliefs
    BANDWAGON_EFFECT = "bandwagon_effect"  # Follow the crowd
    DECOY_EFFECT = "decoy_effect"  # Strategic comparison options

    # Emotional & Motivational
    EMOTIONAL_APPEAL = "emotional_appeal"  # Emotional connection
    FEAR_OF_MISSING_OUT = "fomo"  # FOMO triggers
    PRIDE_OWNERSHIP = "pride_ownership"  # Personal achievement
    PROBLEM_AGITATION = "problem_agitation"  # Intensify pain points

@dataclass
class OutlineElement:
    """Individual element in document outline"""

    id: str = field(default_factory=uuid7str)
    type: str = "section"  # chapter, section, subsection, paragraph
    title: str = ""
    description: str = ""  # What this section contains
    rationale: str = ""  # Why this section is important
    content_guidance: str = ""  # How to write this section
    psychology_biases: List[PsychologyBias] = field(default_factory=list)
    word_count_target: int = 0
    priority: str = "medium"  # high, medium, low
    dependencies: List[str] = field(default_factory=list)  # Other section IDs

    # Hierarchy information
    level: int = 1  # 1=chapter, 2=section, 3=subsection, 4=paragraph
    parent_id: Optional[str] = None
    children: List["OutlineElement"] = field(default_factory=list)

    # Content metadata
    key_points: List[str] = field(default_factory=list)
    supporting_data: List[str] = field(default_factory=list)
    call_to_action: str = ""

@dataclass
class OutlineImprovement:
    """Suggested improvement to outline"""

    id: str = field(default_factory=uuid7str)
    element_id: str = ""  # Which outline element to improve
    improvement_type: str = "enhancement"  # enhancement, restructure, addition, removal
    description: str = ""
    justification: str = ""
    impact_score: float = 0.0  # 0-1 scale
    psychology_benefit: List[PsychologyBias] = field(default_factory=list)
    implementation_difficulty: str = "medium"  # easy, medium, hard

@dataclass
class DocumentOutline:
    """Complete document outline structure"""

    id: str = field(default_factory=uuid7str)
    document_type: DocumentType = DocumentType.BUSINESS_PROPOSAL
    title: str = ""
    executive_summary: str = ""

    # Outline structure
    elements: List[OutlineElement] = field(default_factory=list)
    total_word_count_target: int = 0
    estimated_reading_time: int = 0  # minutes

    # Psychology integration
    primary_biases: List[PsychologyBias] = field(default_factory=list)
    persuasion_strategy: str = ""
    target_audience: str = ""

    # Quality metadata
    complexity_score: float = 0.0
    persuasiveness_score: float = 0.0
    completeness_score: float = 0.0

    # Generation metadata
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    improvements_applied: List[OutlineImprovement] = field(default_factory=list)

@dataclass
class OutlineGenerationResult:
    """Result of outline generation process"""

    success: bool = False
    outline: Optional[DocumentOutline] = None

    # Multi-stage results
    initial_outline: Optional[DocumentOutline] = None
    suggested_improvements: List[OutlineImprovement] = field(default_factory=list)
    final_outline: Optional[DocumentOutline] = None

    # Process metadata
    generation_time: float = 0.0
    model_calls: int = 0
    total_tokens: int = 0

    # Quality scores
    outline_quality: float = 0.0
    psychology_integration: float = 0.0
    structural_coherence: float = 0.0

    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

class DocumentOutlineGenerator:
    """Advanced multi-stage document outline generator with psychology integration"""

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "deepseek-r1:32b",
        ollama_timeout: float = 300.0,  # Longer timeout for complex outline generation
        use_advanced_prompting: bool = True,
    ):
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.ollama_model = ollama_model
        self.ollama_timeout = ollama_timeout
        self.use_advanced_prompting = use_advanced_prompting
        self.logger = logging.getLogger(__name__)

        # Initialize advanced prompting
        if self.use_advanced_prompting:
            from ..prompting_strategies import create_advanced_prompt_builder

            self.prompt_builder = create_advanced_prompt_builder(ollama_model)
        else:
            self.prompt_builder = None

        # Initialize psychology bias descriptions
        self._initialize_psychology_biases()

        # Initialize document templates
        self._initialize_document_templates()

        self.logger.info(
            f"DocumentOutlineGenerator initialized with model: {ollama_model}"
        )

    def _initialize_psychology_biases(self):
        """Initialize descriptions and applications for psychology biases"""
        self.psychology_biases = {
            PsychologyBias.ANCHORING: {
                "description": "Establish reference points early to influence subsequent judgments",
                "application": "Present high-value benefits or costs first to anchor expectations",
                "examples": [
                    "Premium pricing models",
                    "Implementation timelines",
                    "ROI projections",
                ],
            },
            PsychologyBias.SOCIAL_PROOF: {
                "description": "Leverage others' actions and testimonials to build credibility",
                "application": "Include client testimonials, case studies, and industry adoption",
                "examples": [
                    "Client success stories",
                    "Market leader endorsements",
                    "Industry statistics",
                ],
            },
            PsychologyBias.AUTHORITY: {
                "description": "Establish expertise and credibility through credentials and expertise",
                "application": "Highlight team qualifications, certifications, and industry recognition",
                "examples": [
                    "Expert team bios",
                    "Industry certifications",
                    "Award recognition",
                ],
            },
            PsychologyBias.RECIPROCITY: {
                "description": "Provide value upfront to create obligation to reciprocate",
                "application": "Offer free insights, tools, or preliminary analysis",
                "examples": [
                    "Free assessment",
                    "Industry insights",
                    "Best practices guide",
                ],
            },
            PsychologyBias.SCARCITY: {
                "description": "Create urgency through limited availability or time constraints",
                "application": "Emphasize unique capabilities, limited slots, or time-sensitive opportunities",
                "examples": [
                    "Exclusive partnership",
                    "Limited engagement slots",
                    "Market timing",
                ],
            },
            PsychologyBias.LOSS_AVERSION: {
                "description": "Emphasize what the client risks losing by not acting",
                "application": "Highlight competitive disadvantages and missed opportunities",
                "examples": [
                    "Competitive gaps",
                    "Market share erosion",
                    "Regulatory compliance risks",
                ],
            },
            PsychologyBias.EMOTIONAL_APPEAL: {
                "description": "Connect with emotional motivations and aspirations",
                "application": "Appeal to professional pride, organizational vision, and personal success",
                "examples": [
                    "Innovation leadership",
                    "Team empowerment",
                    "Legacy building",
                ],
            },
            PsychologyBias.PROBLEM_AGITATION: {
                "description": "Intensify awareness of pain points before presenting solutions",
                "application": "Quantify problems and their business impact before offering solutions",
                "examples": [
                    "Cost of inaction",
                    "Efficiency gaps",
                    "Security vulnerabilities",
                ],
            },
        }

    def _initialize_document_templates(self):
        """Initialize outline templates for different document types"""
        self.document_templates = {
            DocumentType.BUSINESS_PROPOSAL: {
                "structure": [
                    {
                        "title": "Executive Summary",
                        "level": 1,
                        "word_count": 400,
                        "biases": [
                            PsychologyBias.ANCHORING,
                            PsychologyBias.EMOTIONAL_APPEAL,
                        ],
                    },
                    {
                        "title": "Understanding Your Needs",
                        "level": 1,
                        "word_count": 300,
                        "biases": [
                            PsychologyBias.PROBLEM_AGITATION,
                            PsychologyBias.AUTHORITY,
                        ],
                    },
                    {
                        "title": "Proposed Solution",
                        "level": 1,
                        "word_count": 600,
                        "biases": [
                            PsychologyBias.SOCIAL_PROOF,
                            PsychologyBias.RECIPROCITY,
                        ],
                    },
                    {
                        "title": "Why Choose Us",
                        "level": 1,
                        "word_count": 400,
                        "biases": [
                            PsychologyBias.AUTHORITY,
                            PsychologyBias.SOCIAL_PROOF,
                        ],
                    },
                    {
                        "title": "Investment & ROI",
                        "level": 1,
                        "word_count": 350,
                        "biases": [
                            PsychologyBias.ANCHORING,
                            PsychologyBias.LOSS_AVERSION,
                        ],
                    },
                    {
                        "title": "Implementation Timeline",
                        "level": 1,
                        "word_count": 250,
                        "biases": [PsychologyBias.SCARCITY, PsychologyBias.RECIPROCITY],
                    },
                    {
                        "title": "Next Steps",
                        "level": 1,
                        "word_count": 200,
                        "biases": [
                            PsychologyBias.SCARCITY,
                            PsychologyBias.EMOTIONAL_APPEAL,
                        ],
                    },
                ],
                "total_word_count": 2500,
                "primary_biases": [
                    PsychologyBias.ANCHORING,
                    PsychologyBias.SOCIAL_PROOF,
                    PsychologyBias.AUTHORITY,
                ],
            },
            DocumentType.TECHNICAL_PROPOSAL: {
                "structure": [
                    {
                        "title": "Executive Summary",
                        "level": 1,
                        "word_count": 300,
                        "biases": [PsychologyBias.AUTHORITY, PsychologyBias.ANCHORING],
                    },
                    {
                        "title": "Technical Requirements Analysis",
                        "level": 1,
                        "word_count": 500,
                        "biases": [
                            PsychologyBias.AUTHORITY,
                            PsychologyBias.PROBLEM_AGITATION,
                        ],
                    },
                    {
                        "title": "Proposed Technical Solution",
                        "level": 1,
                        "word_count": 800,
                        "biases": [
                            PsychologyBias.SOCIAL_PROOF,
                            PsychologyBias.AUTHORITY,
                        ],
                    },
                    {
                        "title": "Architecture & Design",
                        "level": 1,
                        "word_count": 600,
                        "biases": [PsychologyBias.AUTHORITY],
                    },
                    {
                        "title": "Implementation Methodology",
                        "level": 1,
                        "word_count": 450,
                        "biases": [
                            PsychologyBias.RECIPROCITY,
                            PsychologyBias.SOCIAL_PROOF,
                        ],
                    },
                    {
                        "title": "Quality Assurance & Testing",
                        "level": 1,
                        "word_count": 300,
                        "biases": [PsychologyBias.LOSS_AVERSION],
                    },
                    {
                        "title": "Team & Expertise",
                        "level": 1,
                        "word_count": 350,
                        "biases": [
                            PsychologyBias.AUTHORITY,
                            PsychologyBias.SOCIAL_PROOF,
                        ],
                    },
                    {
                        "title": "Timeline & Deliverables",
                        "level": 1,
                        "word_count": 300,
                        "biases": [PsychologyBias.SCARCITY, PsychologyBias.ANCHORING],
                    },
                ],
                "total_word_count": 3600,
                "primary_biases": [
                    PsychologyBias.AUTHORITY,
                    PsychologyBias.SOCIAL_PROOF,
                    PsychologyBias.LOSS_AVERSION,
                ],
            },
            DocumentType.RFP_RESPONSE: {
                "structure": [
                    {
                        "title": "Executive Summary",
                        "level": 1,
                        "word_count": 400,
                        "biases": [PsychologyBias.ANCHORING, PsychologyBias.AUTHORITY],
                    },
                    {
                        "title": "RFP Requirements Matrix",
                        "level": 1,
                        "word_count": 200,
                        "biases": [PsychologyBias.AUTHORITY],
                    },
                    {
                        "title": "Technical Response",
                        "level": 1,
                        "word_count": 1000,
                        "biases": [
                            PsychologyBias.AUTHORITY,
                            PsychologyBias.SOCIAL_PROOF,
                        ],
                    },
                    {
                        "title": "Management Approach",
                        "level": 1,
                        "word_count": 600,
                        "biases": [
                            PsychologyBias.RECIPROCITY,
                            PsychologyBias.SOCIAL_PROOF,
                        ],
                    },
                    {
                        "title": "Corporate Experience",
                        "level": 1,
                        "word_count": 500,
                        "biases": [
                            PsychologyBias.SOCIAL_PROOF,
                            PsychologyBias.AUTHORITY,
                        ],
                    },
                    {
                        "title": "Pricing",
                        "level": 1,
                        "word_count": 300,
                        "biases": [
                            PsychologyBias.ANCHORING,
                            PsychologyBias.LOSS_AVERSION,
                        ],
                    },
                    {
                        "title": "Value Added Services",
                        "level": 1,
                        "word_count": 300,
                        "biases": [
                            PsychologyBias.RECIPROCITY,
                            PsychologyBias.SOCIAL_PROOF,
                        ],
                    },
                    {
                        "title": "Conclusion",
                        "level": 1,
                        "word_count": 200,
                        "biases": [
                            PsychologyBias.EMOTIONAL_APPEAL,
                            PsychologyBias.SCARCITY,
                        ],
                    },
                ],
                "total_word_count": 3500,
                "primary_biases": [
                    PsychologyBias.AUTHORITY,
                    PsychologyBias.SOCIAL_PROOF,
                    PsychologyBias.ANCHORING,
                ],
            },
        }

    async def generate_complete_outline(
        self,
        document_type: DocumentType,
        context: Dict[str, Any],
        target_word_count: Optional[int] = None,
    ) -> OutlineGenerationResult:
        """Generate complete multi-stage outline with improvements and psychology integration"""
        start_time = asyncio.get_event_loop().time()
        result = OutlineGenerationResult()

        try:
            if not aiohttp:
                raise ImportError("aiohttp required for outline generation")

            # Stage 1: Generate initial outline
            self.logger.info("Stage 1: Generating initial document outline...")
            result.initial_outline = await self._generate_initial_outline(
                document_type, context, target_word_count
            )
            result.model_calls += 1

            if not result.initial_outline:
                result.errors.append("Failed to generate initial outline")
                return result

            # Stage 2: Identify improvements
            self.logger.info("Stage 2: Identifying outline improvements...")
            result.suggested_improvements = await self._identify_outline_improvements(
                result.initial_outline, context
            )
            result.model_calls += 1

            # Stage 3: Apply improvements
            self.logger.info("Stage 3: Applying outline improvements...")
            result.final_outline = await self._apply_outline_improvements(
                result.initial_outline, result.suggested_improvements, context
            )
            result.model_calls += 1

            # Stage 4: Enhance with psychology biases
            self.logger.info("Stage 4: Enhancing with behavioral psychology...")
            await self._enhance_with_psychology(result.final_outline, context)

            # Final assessment
            await self._assess_outline_quality(result)

            result.outline = result.final_outline
            result.success = len(result.errors) == 0 and result.outline is not None
            result.generation_time = asyncio.get_event_loop().time() - start_time

            self.logger.info(
                f"Multi-stage outline generation completed in {result.generation_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Outline generation failed: {str(e)}")
            self.logger.error(f"Outline generation error: {e}")

        return result

    async def _generate_initial_outline(
        self,
        document_type: DocumentType,
        context: Dict[str, Any],
        target_word_count: Optional[int],
    ) -> Optional[DocumentOutline]:
        """Generate initial structured outline"""

        # Get template for document type
        template = self.document_templates.get(document_type)
        if not template:
            self.logger.warning(
                f"No template found for {document_type}, using business proposal template"
            )
            template = self.document_templates[DocumentType.BUSINESS_PROPOSAL]

        # Build Chain-of-Thought prompt for outline generation
        reasoning_steps = [
            "Analyze the document type, context, and requirements",
            "Review the template structure and adapt it to the specific context",
            "Identify the key chapters and major sections needed",
            "Break down each chapter into logical subsections",
            "Define the purpose and content description for each section",
            "Assign appropriate word counts based on importance and depth",
            "Ensure logical flow and narrative coherence throughout",
            "Add supporting rationale for each structural decision",
        ]

        context_str = self._build_context_string(context)
        task = f"Generate a detailed JSON outline for a {document_type.value.replace('_', ' ')} document"

        # Create the Chain-of-Thought prompt
        cot_prompt = create_chain_of_thought_prompt(
            task=task,
            context=context_str,
            reasoning_steps=reasoning_steps,
            output_format="Return the outline as a well-structured JSON object with nested sections",
            examples=[
                {
                    "input": "Business proposal for software implementation",
                    "reasoning": "Structure should build credibility, demonstrate understanding, present solution, justify investment",
                    "output": "JSON outline with executive summary, needs analysis, solution, team, timeline, pricing",
                }
            ],
        )

        # Add specific instructions for JSON structure
        full_prompt = f"""{cot_prompt}

## Required JSON Structure:
Generate the outline as a JSON object with this structure:
{{
  "document_type": "{document_type.value}",
  "title": "Document title based on context",
  "executive_summary": "Brief description of what this document will accomplish",
  "total_word_count_target": {target_word_count or template["total_word_count"]},
  "elements": [
    {{
      "id": "unique_id",
      "type": "chapter",
      "level": 1,
      "title": "Chapter Title",
      "description": "Detailed description of what this chapter will contain",
      "rationale": "Why this chapter is important and how it contributes to the document goals",
      "content_guidance": "Specific guidance on how to write this section effectively",
      "word_count_target": 400,
      "priority": "high",
      "key_points": ["key point 1", "key point 2"],
      "children": [
        {{
          "id": "unique_subsection_id",
          "type": "section",
          "level": 2,
          "title": "Section Title",
          "description": "What this section contains",
          "rationale": "Why this section matters",
          "word_count_target": 200,
          "key_points": ["specific point 1"]
        }}
      ]
    }}
  ]
}}

Please generate the complete outline now:"""

        # Make API call
        timeout = ClientTimeout(total=self.ollama_timeout)

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with (
                    session.post(
                        f"{self.ollama_base_url}/api/generate",
                        json={
                            "model": self.ollama_model,
                            "prompt": full_prompt,
                            "stream": False,
                            "options": {
                                "temperature": 0.3,  # More deterministic for structured output
                                "top_p": 0.9,
                                "num_predict": 2000,  # Large enough for detailed outline
                            },
                        },
                    ) as response
                ):
                    if response.status == 200:
                        result = await response.json()
                        generated_text = result.get("response", "").strip()

                        # Filter thinking tags if using deepseek-r1
                        if "deepseek-r1" in self.ollama_model:
                            generated_text = filter_thinking_tags(generated_text)

                        # Parse JSON from response
                        outline = await self._parse_outline_json(
                            generated_text, document_type
                        )
                        return outline
                    else:
                        self.logger.error(f"Ollama API error: {response.status}")
                        return None

        except Exception as e:
            self.logger.error(f"Error generating initial outline: {e}")
            return None

    async def _parse_outline_json(
        self, response_text: str, document_type: DocumentType
    ) -> Optional[DocumentOutline]:
        """Parse JSON outline from model response"""
        try:
            # Extract JSON from response (it might be wrapped in markdown or text)
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1

            if json_start == -1 or json_end == 0:
                self.logger.error("No JSON found in response")
                return None

            json_str = response_text[json_start:json_end]
            outline_data = json.loads(json_str)

            # Create DocumentOutline object
            outline = DocumentOutline(
                document_type=document_type,
                title=outline_data.get("title", ""),
                executive_summary=outline_data.get("executive_summary", ""),
                total_word_count_target=outline_data.get(
                    "total_word_count_target", 2000
                ),
            )

            # Parse elements
            elements_data = outline_data.get("elements", [])
            outline.elements = self._parse_outline_elements(elements_data)

            return outline

        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing error: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error parsing outline: {e}")
            return None

    def _parse_outline_elements(
        self, elements_data: List[Dict]
    ) -> List[OutlineElement]:
        """Recursively parse outline elements from JSON data"""
        elements = []

        for element_data in elements_data:
            element = OutlineElement(
                id=element_data.get("id", uuid7str()),
                type=element_data.get("type", "section"),
                title=element_data.get("title", ""),
                description=element_data.get("description", ""),
                rationale=element_data.get("rationale", ""),
                content_guidance=element_data.get("content_guidance", ""),
                word_count_target=element_data.get("word_count_target", 200),
                priority=element_data.get("priority", "medium"),
                level=element_data.get("level", 1),
                key_points=element_data.get("key_points", []),
            )

            # Parse children recursively
            children_data = element_data.get("children", [])
            if children_data:
                element.children = self._parse_outline_elements(children_data)
                # Set parent relationships
                for child in element.children:
                    child.parent_id = element.id

            elements.append(element)

        return elements

    def _build_context_string(self, context: Dict[str, Any]) -> str:
        """Build context string from provided context dictionary"""
        context_parts = []

        if context.get("project_name"):
            context_parts.append(f"Project: {context['project_name']}")

        if context.get("client_name"):
            context_parts.append(f"Client: {context['client_name']}")

        if context.get("industry"):
            context_parts.append(f"Industry: {context['industry']}")

        if context.get("objectives"):
            context_parts.append(f"Objectives: {', '.join(context['objectives'])}")

        if context.get("key_requirements"):
            context_parts.append(
                f"Key Requirements: {', '.join(context['key_requirements'])}"
            )

        if context.get("target_audience"):
            context_parts.append(f"Target Audience: {context['target_audience']}")

        if context.get("budget_range"):
            context_parts.append(f"Budget Range: {context['budget_range']}")

        if context.get("timeline"):
            context_parts.append(f"Timeline: {context['timeline']}")

        return (
            "\n".join(context_parts)
            if context_parts
            else "No specific context provided"
        )

    async def _identify_outline_improvements(
        self, outline: DocumentOutline, context: Dict[str, Any]
    ) -> List[OutlineImprovement]:
        """Identify and justify 10 high-impact improvements to the outline"""

        # Create Chain-of-Thought prompt for improvement identification
        reasoning_steps = [
            "Analyze the current outline structure for logical flow and completeness",
            "Identify gaps in persuasive argumentation and value proposition",
            "Assess opportunities to strengthen credibility and authority",
            "Evaluate integration of behavioral psychology principles",
            "Consider narrative flow and reader engagement optimization",
            "Identify redundancies or opportunities for consolidation",
            "Assess balance between sections and word count allocation",
            "Recommend specific, actionable improvements with justification",
            "Prioritize improvements by business impact and persuasive power",
            "Provide implementation guidance for each improvement",
        ]

        # Convert outline to string representation for analysis
        outline_summary = self._outline_to_summary(outline)
        context_str = self._build_context_string(context)

        task = "Analyze the document outline and identify exactly 10 high-impact improvements"

        cot_prompt = create_chain_of_thought_prompt(
            task=task,
            context=f"Document Context:\n{context_str}\n\nCurrent Outline:\n{outline_summary}",
            reasoning_steps=reasoning_steps,
            output_format="Return improvements as a JSON array with detailed justifications",
            examples=[
                {
                    "input": "Business proposal outline missing competitive differentiation",
                    "reasoning": "Outline lacks explicit competitive advantages section, reducing persuasive impact",
                    "output": 'Add "Competitive Advantages" section with social proof and authority biases',
                }
            ],
        )

        # Add specific instructions for improvement format
        full_prompt = f"""{cot_prompt}

## Required Improvements JSON Structure:
Return exactly 10 improvements as a JSON array:
[
  {{
    "element_id": "section_id_to_improve",
    "improvement_type": "enhancement|restructure|addition|removal",
    "description": "Specific improvement description",
    "justification": "Detailed business and psychological justification",
    "impact_score": 0.85,
    "psychology_benefit": ["social_proof", "authority"],
    "implementation_difficulty": "easy|medium|hard"
  }}
]

Focus on improvements that will:
1. Strengthen persuasive impact
2. Enhance credibility and authority
3. Improve logical flow and readability
4. Integrate behavioral psychology more effectively
5. Address potential client concerns proactively
6. Optimize for decision-maker psychology
7. Enhance competitive differentiation
8. Improve call-to-action effectiveness
9. Strengthen value proposition communication
10. Optimize narrative structure for maximum impact

Generate the 10 improvements now:"""

        # Make API call for improvement identification
        timeout = ClientTimeout(total=self.ollama_timeout)

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with (
                    session.post(
                        f"{self.ollama_base_url}/api/generate",
                        json={
                            "model": self.ollama_model,
                            "prompt": full_prompt,
                            "stream": False,
                            "options": {
                                "temperature": 0.4,  # Slightly more creative for improvements
                                "top_p": 0.9,
                                "num_predict": 1500,
                            },
                        },
                    ) as response
                ):
                    if response.status == 200:
                        result = await response.json()
                        generated_text = result.get("response", "").strip()

                        # Filter thinking tags if using deepseek-r1
                        if "deepseek-r1" in self.ollama_model:
                            generated_text = filter_thinking_tags(generated_text)

                        # Parse improvements from response
                        improvements = await self._parse_improvements_json(
                            generated_text
                        )
                        return improvements or []
                    else:
                        self.logger.error(f"Ollama API error: {response.status}")
                        return []

        except Exception as e:
            self.logger.error(f"Error identifying improvements: {e}")
            return []

    def _outline_to_summary(self, outline: DocumentOutline) -> str:
        """Convert outline to string summary for analysis"""
        summary_parts = [f"Title: {outline.title}"]
        summary_parts.append(
            f"Total Word Count Target: {outline.total_word_count_target}"
        )
        summary_parts.append(f"Document Type: {outline.document_type.value}")
        summary_parts.append("")
        summary_parts.append("Structure:")

        for element in outline.elements:
            self._add_element_to_summary(element, summary_parts, indent=0)

        return "\n".join(summary_parts)

    def _add_element_to_summary(
        self, element: OutlineElement, summary_parts: List[str], indent: int
    ):
        """Recursively add element to summary"""
        indent_str = "  " * indent
        summary_parts.append(
            f"{indent_str}- {element.title} ({element.word_count_target} words)"
        )
        summary_parts.append(f"{indent_str}  Description: {element.description}")
        if element.rationale:
            summary_parts.append(f"{indent_str}  Rationale: {element.rationale}")

        for child in element.children:
            self._add_element_to_summary(child, summary_parts, indent + 1)

    async def _parse_improvements_json(
        self, response_text: str
    ) -> List[OutlineImprovement]:
        """Parse improvements JSON from model response"""
        try:
            # Extract JSON array from response
            json_start = response_text.find("[")
            json_end = response_text.rfind("]") + 1

            if json_start == -1 or json_end == 0:
                self.logger.error("No JSON array found in improvements response")
                return []

            json_str = response_text[json_start:json_end]
            improvements_data = json.loads(json_str)

            improvements = []
            for imp_data in improvements_data:
                # Parse psychology benefits
                psychology_benefits = []
                for bias_str in imp_data.get("psychology_benefit", []):
                    try:
                        bias = PsychologyBias(bias_str)
                        psychology_benefits.append(bias)
                    except ValueError:
                        # Skip invalid bias names
                        self.logger.warning("ValueError in unknown: {names}", names)

                improvement = OutlineImprovement(
                    element_id=imp_data.get("element_id", ""),
                    improvement_type=imp_data.get("improvement_type", "enhancement"),
                    description=imp_data.get("description", ""),
                    justification=imp_data.get("justification", ""),
                    impact_score=float(imp_data.get("impact_score", 0.5)),
                    psychology_benefit=psychology_benefits,
                    implementation_difficulty=imp_data.get(
                        "implementation_difficulty", "medium"
                    ),
                )

                improvements.append(improvement)

            return improvements[:10]  # Ensure exactly 10 improvements

        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing error for improvements: {e}")
            return []
        except Exception as e:
            self.logger.error(f"Error parsing improvements: {e}")
            return []

    async def _apply_outline_improvements(
        self,
        original_outline: DocumentOutline,
        improvements: List[OutlineImprovement],
        context: Dict[str, Any],
    ) -> DocumentOutline:
        """Apply identified improvements to create enhanced outline"""

        # Create a copy of the original outline
        enhanced_outline = DocumentOutline(
            document_type=original_outline.document_type,
            title=original_outline.title,
            executive_summary=original_outline.executive_summary,
            total_word_count_target=original_outline.total_word_count_target,
            elements=self._deep_copy_elements(original_outline.elements),
            improvements_applied=improvements.copy(),
        )

        # Sort improvements by impact score (highest first)
        sorted_improvements = sorted(
            improvements, key=lambda x: x.impact_score, reverse=True
        )

        # Apply each improvement
        for improvement in sorted_improvements:
            try:
                await self._apply_single_improvement(
                    enhanced_outline, improvement, context
                )
            except Exception as e:
                self.logger.warning(
                    f"Failed to apply improvement {improvement.id}: {e}"
                )

        return enhanced_outline

    def _deep_copy_elements(
        self, elements: List[OutlineElement]
    ) -> List[OutlineElement]:
        """Deep copy outline elements"""
        copied_elements = []

        for element in elements:
            copied_element = OutlineElement(
                id=element.id,
                type=element.type,
                title=element.title,
                description=element.description,
                rationale=element.rationale,
                content_guidance=element.content_guidance,
                psychology_biases=element.psychology_biases.copy(),
                word_count_target=element.word_count_target,
                priority=element.priority,
                dependencies=element.dependencies.copy(),
                level=element.level,
                parent_id=element.parent_id,
                children=self._deep_copy_elements(element.children),
                key_points=element.key_points.copy(),
                supporting_data=element.supporting_data.copy(),
                call_to_action=element.call_to_action,
            )
            copied_elements.append(copied_element)

        return copied_elements

    async def _apply_single_improvement(
        self,
        outline: DocumentOutline,
        improvement: OutlineImprovement,
        context: Dict[str, Any],
    ):
        """Apply a single improvement to the outline"""

        if improvement.improvement_type == "addition":
            # Add new section
            await self._add_new_section(outline, improvement, context)

        elif improvement.improvement_type == "enhancement":
            # Enhance existing section
            await self._enhance_existing_section(outline, improvement)

        elif improvement.improvement_type == "restructure":
            # Restructure sections
            await self._restructure_sections(outline, improvement)

        elif improvement.improvement_type == "removal":
            # Remove or consolidate sections
            await self._remove_section(outline, improvement)

    async def _add_new_section(
        self,
        outline: DocumentOutline,
        improvement: OutlineImprovement,
        context: Dict[str, Any],
    ):
        """Add a new section based on improvement suggestion"""

        # Create new outline element
        new_element = OutlineElement(
            type="section",
            title=improvement.description.split(":")[0].strip()
            if ":" in improvement.description
            else improvement.description,
            description=improvement.description,
            rationale=improvement.justification,
            content_guidance=f"Focus on {', '.join([bias.value for bias in improvement.psychology_benefit])} psychology principles",
            psychology_biases=improvement.psychology_benefit,
            word_count_target=self._estimate_word_count_for_new_section(improvement),
            priority="high" if improvement.impact_score > 0.7 else "medium",
            level=2,  # Default to section level
        )

        # Add to appropriate location in outline
        if improvement.element_id:
            # Add as child to specific element
            parent_element = self._find_element_by_id(
                outline.elements, improvement.element_id
            )
            if parent_element:
                new_element.parent_id = parent_element.id
                new_element.level = parent_element.level + 1
                parent_element.children.append(new_element)
        else:
            # Add as top-level section
            outline.elements.append(new_element)

    async def _enhance_existing_section(
        self, outline: DocumentOutline, improvement: OutlineImprovement
    ):
        """Enhance an existing section based on improvement suggestion"""

        element = self._find_element_by_id(outline.elements, improvement.element_id)
        if element:
            # Enhance description with improvement details
            if improvement.description not in element.description:
                element.description += f" {improvement.description}"

            # Update rationale
            element.rationale += f" {improvement.justification}"

            # Add psychology biases
            for bias in improvement.psychology_benefit:
                if bias not in element.psychology_biases:
                    element.psychology_biases.append(bias)

            # Update content guidance
            bias_guidance = [bias.value for bias in improvement.psychology_benefit]
            if bias_guidance:
                element.content_guidance += (
                    f" Integrate {', '.join(bias_guidance)} principles."
                )

            # Increase priority if high impact
            if improvement.impact_score > 0.7:
                element.priority = "high"

    async def _restructure_sections(
        self, outline: DocumentOutline, improvement: OutlineImprovement
    ):
        """Restructure sections based on improvement suggestion"""
        # This would involve more complex restructuring logic
        # For now, we'll enhance the target section with restructuring notes
        element = self._find_element_by_id(outline.elements, improvement.element_id)
        if element:
            element.content_guidance += (
                f" RESTRUCTURING NOTE: {improvement.description}"
            )
            element.rationale += (
                f" Restructuring rationale: {improvement.justification}"
            )

    async def _remove_section(
        self, outline: DocumentOutline, improvement: OutlineImprovement
    ):
        """Remove or consolidate a section"""
        # Mark section for consolidation rather than actual removal
        element = self._find_element_by_id(outline.elements, improvement.element_id)
        if element:
            element.content_guidance += (
                f" CONSOLIDATION NOTE: {improvement.description}"
            )
            element.priority = "low"  # Mark as lower priority

    def _find_element_by_id(
        self, elements: List[OutlineElement], element_id: str
    ) -> Optional[OutlineElement]:
        """Recursively find element by ID"""
        for element in elements:
            if element.id == element_id:
                return element

            # Search in children
            found = self._find_element_by_id(element.children, element_id)
            if found:
                return found

        return None

    def _estimate_word_count_for_new_section(
        self, improvement: OutlineImprovement
    ) -> int:
        """Estimate word count for new section based on improvement details"""
        base_word_count = 200

        # Adjust based on impact score
        word_count = int(base_word_count * (1 + improvement.impact_score))

        # Adjust based on psychology complexity
        psychology_multiplier = 1 + (len(improvement.psychology_benefit) * 0.1)
        word_count = int(word_count * psychology_multiplier)

        return min(word_count, 500)  # Cap at 500 words

    async def _enhance_with_psychology(
        self, outline: DocumentOutline, context: Dict[str, Any]
    ):
        """Enhance outline with behavioral psychology and economic biases"""

        # Analyze context to determine primary biases to emphasize
        primary_biases = self._select_primary_biases(context)
        outline.primary_biases = primary_biases

        # Set persuasion strategy based on document type and context
        outline.persuasion_strategy = self._determine_persuasion_strategy(
            outline.document_type, context
        )

        # Enhance each element with appropriate psychology biases
        for element in outline.elements:
            await self._enhance_element_with_psychology(element, primary_biases)

    def _select_primary_biases(self, context: Dict[str, Any]) -> List[PsychologyBias]:
        """Select primary psychology biases based on context"""
        biases = []

        # Always include authority and social proof for business contexts
        biases.extend([PsychologyBias.AUTHORITY, PsychologyBias.SOCIAL_PROOF])

        # Add context-specific biases
        if context.get("competitive_situation"):
            biases.append(PsychologyBias.SCARCITY)

        if context.get("budget_constraints"):
            biases.append(PsychologyBias.LOSS_AVERSION)

        if context.get("urgent_timeline"):
            biases.append(PsychologyBias.SCARCITY)

        if context.get("relationship_building"):
            biases.append(PsychologyBias.RECIPROCITY)

        return biases[:4]  # Limit to 4 primary biases

    def _determine_persuasion_strategy(
        self, document_type: DocumentType, context: Dict[str, Any]
    ) -> str:
        """Determine overall persuasion strategy"""
        if document_type == DocumentType.TECHNICAL_PROPOSAL:
            return "Authority-based with technical credibility and proven methodologies"
        elif document_type == DocumentType.BUSINESS_PROPOSAL:
            return "Value-focused with social proof and emotional appeal to business success"
        elif document_type == DocumentType.RFP_RESPONSE:
            return (
                "Compliance-first with competitive differentiation and risk mitigation"
            )
        else:
            return "Balanced approach with authority, social proof, and value demonstration"

    async def _enhance_element_with_psychology(
        self, element: OutlineElement, primary_biases: List[PsychologyBias]
    ):
        """Enhance individual element with psychology biases"""

        # Assign biases based on element type and position
        if element.title.lower() in ["executive summary", "introduction"]:
            element.psychology_biases.extend(
                [PsychologyBias.ANCHORING, PsychologyBias.EMOTIONAL_APPEAL]
            )

        elif "team" in element.title.lower() or "experience" in element.title.lower():
            element.psychology_biases.extend(
                [PsychologyBias.AUTHORITY, PsychologyBias.SOCIAL_PROOF]
            )

        elif (
            "cost" in element.title.lower()
            or "investment" in element.title.lower()
            or "roi" in element.title.lower()
        ):
            element.psychology_biases.extend(
                [PsychologyBias.ANCHORING, PsychologyBias.LOSS_AVERSION]
            )

        elif (
            "timeline" in element.title.lower() or "next steps" in element.title.lower()
        ):
            element.psychology_biases.extend(
                [PsychologyBias.SCARCITY, PsychologyBias.RECIPROCITY]
            )

        elif "solution" in element.title.lower() or "approach" in element.title.lower():
            element.psychology_biases.extend(
                [PsychologyBias.SOCIAL_PROOF, PsychologyBias.AUTHORITY]
            )

        # Remove duplicates
        element.psychology_biases = list(set(element.psychology_biases))

        # Update content guidance with psychology integration
        if element.psychology_biases:
            bias_names = [bias.value for bias in element.psychology_biases]
            element.content_guidance += (
                f" Leverage {', '.join(bias_names)} psychology principles."
            )

        # Recursively enhance children
        for child in element.children:
            await self._enhance_element_with_psychology(child, primary_biases)

    async def _assess_outline_quality(self, result: OutlineGenerationResult):
        """Assess the quality of the generated outline"""
        if not result.final_outline:
            return

        outline = result.final_outline

        # Structural coherence score
        result.structural_coherence = self._assess_structural_coherence(outline)

        # Psychology integration score
        result.psychology_integration = self._assess_psychology_integration(outline)

        # Overall quality score
        result.outline_quality = (
            result.structural_coherence + result.psychology_integration
        ) / 2

        # Set outline quality scores
        outline.complexity_score = len(outline.elements) / 10.0  # Normalize complexity
        outline.persuasiveness_score = result.psychology_integration
        outline.completeness_score = result.structural_coherence

    def _assess_structural_coherence(self, outline: DocumentOutline) -> float:
        """Assess structural coherence of the outline"""
        score = 0.7  # Base score

        # Check for essential sections
        essential_sections = ["executive summary", "solution", "team", "timeline"]
        found_sections = 0

        for element in outline.elements:
            element_title_lower = element.title.lower()
            for essential in essential_sections:
                if essential in element_title_lower:
                    found_sections += 1
                    break

        # Boost score based on essential sections coverage
        score += (found_sections / len(essential_sections)) * 0.2

        # Check logical progression (simplified)
        if len(outline.elements) > 3:  # Has sufficient depth
            score += 0.1

        return min(score, 1.0)

    def _assess_psychology_integration(self, outline: DocumentOutline) -> float:
        """Assess psychology integration quality"""
        total_elements = self._count_all_elements(outline.elements)
        elements_with_psychology = self._count_elements_with_psychology(
            outline.elements
        )

        if total_elements == 0:
            return 0.0

        base_score = elements_with_psychology / total_elements

        # Bonus for primary biases being set
        if outline.primary_biases:
            base_score += 0.1

        # Bonus for persuasion strategy
        if outline.persuasion_strategy:
            base_score += 0.1

        return min(base_score, 1.0)

    def _count_all_elements(self, elements: List[OutlineElement]) -> int:
        """Count total elements including children"""
        count = len(elements)
        for element in elements:
            count += self._count_all_elements(element.children)
        return count

    def _count_elements_with_psychology(self, elements: List[OutlineElement]) -> int:
        """Count elements that have psychology biases assigned"""
        count = 0
        for element in elements:
            if element.psychology_biases:
                count += 1
            count += self._count_elements_with_psychology(element.children)
        return count

    async def close(self):
        """Close outline generator and cleanup resources"""
        self.logger.info("DocumentOutlineGenerator closed")

    def get_generator_info(self) -> Dict[str, Any]:
        """Get comprehensive generator information"""
        return {
            "generator_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "supported_document_types": [doc_type.value for doc_type in DocumentType],
            "supported_psychology_biases": [bias.value for bias in PsychologyBias],
            "features": {
                "multi_stage_generation": True,
                "outline_improvement": True,
                "psychology_integration": True,
                "behavioral_economics": True,
                "json_structured_output": True,
                "iterative_enhancement": True,
            },
            "templates_available": len(self.document_templates),
            "psychology_biases_available": len(self.psychology_biases),
        }

# Factory function
def create_document_outline_generator(
    config: Optional[Dict[str, Any]] = None,
) -> DocumentOutlineGenerator:
    """Create DocumentOutlineGenerator instance with configuration"""
    if config is None:
        config = {}

    return DocumentOutlineGenerator(
        ollama_base_url=config.get("ollama_base_url", "http://localhost:11434"),
        ollama_model=config.get("ollama_model", "deepseek-r1:32b"),
        ollama_timeout=config.get("ollama_timeout", 300.0),
        use_advanced_prompting=config.get("use_advanced_prompting", True),
    )
