#!/usr/bin/env python3
"""
Content Generator with Ollama Integration

AI-powered content generation for proposals, sections, and document enhancement
with comprehensive customization and quality controls.
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union

try:
    import aiohttp
    from aiohttp import ClientError, ClientTimeout
except ImportError:
    aiohttp = None

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


# Advanced prompting strategies for deepseek-r1:32b
from ..prompting_strategies import (
    AdvancedPromptBuilder,
    PromptingStrategy,
    ThoughtBranch,
    create_chain_of_thought_prompt,
    create_tree_of_thought_prompt,
    filter_thinking_tags,
)


class ContentType(Enum):
    """Comprehensive types of content that can be generated"""

    # Executive & Summary Content
    EXECUTIVE_SUMMARY = "executive_summary"
    EXECUTIVE_OVERVIEW = "executive_overview"
    PROJECT_SUMMARY = "project_summary"
    BUSINESS_CASE = "business_case"
    VALUE_PROPOSITION = "value_proposition"
    KEY_HIGHLIGHTS = "key_highlights"

    # Technical Content
    TECHNICAL_OVERVIEW = "technical_overview"
    TECHNICAL_SPECIFICATION = "technical_specification"
    TECHNICAL_REQUIREMENTS = "technical_requirements"
    ARCHITECTURE_OVERVIEW = "architecture_overview"
    SYSTEM_DESIGN = "system_design"
    INTEGRATION_PLAN = "integration_plan"
    TECHNOLOGY_STACK = "technology_stack"
    SECURITY_APPROACH = "security_approach"
    PERFORMANCE_REQUIREMENTS = "performance_requirements"
    SCALABILITY_PLAN = "scalability_plan"

    # Methodology & Approach
    APPROACH_METHODOLOGY = "approach_methodology"
    PROJECT_METHODOLOGY = "project_methodology"
    IMPLEMENTATION_APPROACH = "implementation_approach"
    DELIVERY_METHODOLOGY = "delivery_methodology"
    AGILE_APPROACH = "agile_approach"
    WATERFALL_APPROACH = "waterfall_approach"
    HYBRID_METHODOLOGY = "hybrid_methodology"
    BEST_PRACTICES = "best_practices"
    QUALITY_ASSURANCE = "quality_assurance"
    TESTING_STRATEGY = "testing_strategy"

    # Project Management
    PROJECT_TIMELINE = "project_timeline"
    PROJECT_SCHEDULE = "project_schedule"
    MILESTONE_PLAN = "milestone_plan"
    DELIVERABLES_SCHEDULE = "deliverables_schedule"
    WORK_BREAKDOWN = "work_breakdown"
    RESOURCE_ALLOCATION = "resource_allocation"
    PROJECT_GOVERNANCE = "project_governance"
    COMMUNICATION_PLAN = "communication_plan"
    CHANGE_MANAGEMENT = "change_management"

    # Risk & Compliance
    RISK_ASSESSMENT = "risk_assessment"
    RISK_MANAGEMENT = "risk_management"
    MITIGATION_STRATEGIES = "mitigation_strategies"
    CONTINGENCY_PLAN = "contingency_plan"
    COMPLIANCE_APPROACH = "compliance_approach"
    REGULATORY_COMPLIANCE = "regulatory_compliance"
    DATA_GOVERNANCE = "data_governance"
    PRIVACY_PROTECTION = "privacy_protection"

    # Financial Content
    COST_BREAKDOWN = "cost_breakdown"
    BUDGET_ANALYSIS = "budget_analysis"
    PRICING_STRATEGY = "pricing_strategy"
    COST_JUSTIFICATION = "cost_justification"
    ROI_ANALYSIS = "roi_analysis"
    FINANCIAL_BENEFITS = "financial_benefits"
    PAYMENT_TERMS = "payment_terms"
    CONTRACT_TERMS = "contract_terms"

    # Team & Resources
    TEAM_OVERVIEW = "team_overview"
    TEAM_STRUCTURE = "team_structure"
    KEY_PERSONNEL = "key_personnel"
    STAFF_QUALIFICATIONS = "staff_qualifications"
    ORGANIZATIONAL_CHART = "organizational_chart"
    ROLES_RESPONSIBILITIES = "roles_responsibilities"
    RESOURCE_REQUIREMENTS = "resource_requirements"
    TRAINING_PLAN = "training_plan"
    KNOWLEDGE_TRANSFER = "knowledge_transfer"

    # Solutions & Benefits
    SOLUTION_OVERVIEW = "solution_overview"
    SOLUTION_ARCHITECTURE = "solution_architecture"
    SOLUTION_BENEFITS = "solution_benefits"
    BUSINESS_BENEFITS = "business_benefits"
    TECHNICAL_BENEFITS = "technical_benefits"
    COMPETITIVE_ADVANTAGES = "competitive_advantages"
    INNOVATION_ASPECTS = "innovation_aspects"
    SUSTAINABILITY_BENEFITS = "sustainability_benefits"

    # Requirements & Specifications
    FUNCTIONAL_REQUIREMENTS = "functional_requirements"
    NON_FUNCTIONAL_REQUIREMENTS = "non_functional_requirements"
    USER_REQUIREMENTS = "user_requirements"
    SYSTEM_REQUIREMENTS = "system_requirements"
    INTERFACE_REQUIREMENTS = "interface_requirements"
    DATA_REQUIREMENTS = "data_requirements"
    REPORTING_REQUIREMENTS = "reporting_requirements"

    # Implementation & Deployment
    IMPLEMENTATION_PLAN = "implementation_plan"
    DEPLOYMENT_STRATEGY = "deployment_strategy"
    MIGRATION_APPROACH = "migration_approach"
    ROLLOUT_PLAN = "rollout_plan"
    GO_LIVE_STRATEGY = "go_live_strategy"
    POST_IMPLEMENTATION = "post_implementation"
    MAINTENANCE_PLAN = "maintenance_plan"
    SUPPORT_STRATEGY = "support_strategy"

    # Experience & Credentials
    COMPANY_BACKGROUND = "company_background"
    RELEVANT_EXPERIENCE = "relevant_experience"
    CASE_STUDIES = "case_studies"
    CLIENT_TESTIMONIALS = "client_testimonials"
    SUCCESS_STORIES = "success_stories"
    CERTIFICATIONS = "certifications"
    AWARDS_RECOGNITION = "awards_recognition"
    PAST_PERFORMANCE = "past_performance"

    # Sections & Structure
    INTRODUCTION = "introduction"
    CONCLUSION = "conclusion"
    SECTION_INTRODUCTION = "section_introduction"
    SECTION_CONCLUSION = "section_conclusion"
    TRANSITION_PARAGRAPH = "transition_paragraph"
    PROBLEM_STATEMENT = "problem_statement"
    NEEDS_ANALYSIS = "needs_analysis"
    SCOPE_OF_WORK = "scope_of_work"
    OUT_OF_SCOPE = "out_of_scope"
    ASSUMPTIONS = "assumptions"
    CONSTRAINTS = "constraints"
    SUCCESS_CRITERIA = "success_criteria"

    # Specialized Content
    BULLET_POINTS = "bullet_points"
    NUMBERED_LIST = "numbered_list"
    COMPARISON_TABLE = "comparison_table"
    FEATURE_LIST = "feature_list"
    BENEFITS_LIST = "benefits_list"
    REQUIREMENTS_LIST = "requirements_list"
    CHECKLIST = "checklist"
    FAQ_SECTION = "faq_section"
    GLOSSARY = "glossary"
    APPENDIX = "appendix"

    # Industry-Specific
    HEALTHCARE_COMPLIANCE = "healthcare_compliance"
    FINANCIAL_COMPLIANCE = "financial_compliance"
    GOVERNMENT_REQUIREMENTS = "government_requirements"
    EDUCATION_APPROACH = "education_approach"
    MANUFACTURING_PROCESS = "manufacturing_process"
    RETAIL_SOLUTION = "retail_solution"

    # Custom & Flexible
    PARAGRAPH_EXPANSION = "paragraph_expansion"
    CUSTOM_CONTENT = "custom_content"
    TEMPLATE_BASED = "template_based"


class GenerationStyle(Enum):
    """Comprehensive writing styles for content generation"""

    # Business Styles
    PROFESSIONAL = "professional"
    EXECUTIVE = "executive"
    CORPORATE = "corporate"
    BUSINESS_CASUAL = "business_casual"
    CONSULTATIVE = "consultative"
    STRATEGIC = "strategic"

    # Technical Styles
    TECHNICAL = "technical"
    TECHNICAL_DETAILED = "technical_detailed"
    TECHNICAL_OVERVIEW = "technical_overview"
    ENGINEERING = "engineering"
    SCIENTIFIC = "scientific"
    SPECIFICATION = "specification"

    # Communication Styles
    PERSUASIVE = "persuasive"
    INFORMATIVE = "informative"
    EDUCATIONAL = "educational"
    EXPLANATORY = "explanatory"
    INSTRUCTIONAL = "instructional"
    ANALYTICAL = "analytical"

    # Tone Styles
    FORMAL = "formal"
    SEMI_FORMAL = "semi_formal"
    CONVERSATIONAL = "conversational"
    FRIENDLY = "friendly"
    AUTHORITATIVE = "authoritative"
    DIPLOMATIC = "diplomatic"
    CONFIDENT = "confident"
    CAUTIOUS = "cautious"

    # Length & Detail Styles
    CONCISE = "concise"
    DETAILED = "detailed"
    COMPREHENSIVE = "comprehensive"
    BRIEF = "brief"
    EXECUTIVE_BRIEF = "executive_brief"
    IN_DEPTH = "in_depth"

    # Audience-Specific Styles
    C_LEVEL = "c_level"
    MANAGEMENT = "management"
    END_USER = "end_user"
    TECHNICAL_TEAM = "technical_team"
    GOVERNMENT = "government"
    ACADEMIC = "academic"

    # Industry-Specific Styles
    HEALTHCARE = "healthcare"
    FINANCIAL = "financial"
    LEGAL = "legal"
    MANUFACTURING = "manufacturing"
    RETAIL = "retail"
    TECHNOLOGY = "technology"

    # Proposal-Specific Styles
    COMPETITIVE = "competitive"
    COLLABORATIVE = "collaborative"
    SOLUTION_FOCUSED = "solution_focused"
    BENEFIT_DRIVEN = "benefit_driven"
    PROBLEM_SOLVING = "problem_solving"
    INNOVATION_FOCUSED = "innovation_focused"


class ContentFormat(Enum):
    """Output formats for generated content"""

    PLAIN_TEXT = "plain_text"
    MARKDOWN = "markdown"
    STRUCTURED_JSON = "structured_json"
    BULLET_LIST = "bullet_list"
    NUMBERED_LIST = "numbered_list"
    PARAGRAPH_FORM = "paragraph_form"


@dataclass
class GenerationContext:
    """Context information for content generation"""

    # Document context
    document_type: str = "proposal"
    industry: str = ""
    company_name: str = ""
    client_name: str = ""
    project_name: str = ""

    # Content requirements
    target_audience: str = "business_professionals"
    tone: str = "professional"
    length_requirement: str = "medium"  # short, medium, long, custom
    word_count_target: Optional[int] = None

    # Supporting information
    key_points: List[str] = field(default_factory=list)
    requirements: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    existing_content: str = ""

    # Style preferences
    include_examples: bool = True
    include_benefits: bool = True
    use_active_voice: bool = True
    avoid_jargon: bool = False


@dataclass
class GenerationPrompt:
    """Structured prompt for content generation"""

    main_instruction: str = ""
    context_information: str = ""
    style_guidelines: str = ""
    format_requirements: str = ""
    quality_criteria: str = ""
    examples: List[str] = field(default_factory=list)


@dataclass
class GeneratedContent:
    """Generated content with metadata"""

    id: str = field(default_factory=uuid7str)
    content: str = ""
    content_type: ContentType = ContentType.CUSTOM_CONTENT
    format: ContentFormat = ContentFormat.PLAIN_TEXT

    # Generation metadata
    word_count: int = 0
    estimated_reading_time: float = 0.0
    style_score: float = 0.0
    quality_score: float = 0.0

    # AI model information
    model_used: str = ""
    generation_parameters: Dict[str, Any] = field(default_factory=dict)
    prompt_tokens: int = 0
    completion_tokens: int = 0


@dataclass
class ContentGenerationResult:
    """Complete content generation result"""

    success: bool = False
    generation_id: str = field(default_factory=uuid7str)

    # Generated content
    primary_content: Optional[GeneratedContent] = None
    alternative_versions: List[GeneratedContent] = field(default_factory=list)

    # Quality assessment
    coherence_score: float = 0.0
    relevance_score: float = 0.0
    completeness_score: float = 0.0
    style_consistency: float = 0.0

    # Generation metadata
    processing_time: float = 0.0
    total_tokens_used: int = 0
    model_calls: int = 0

    # Feedback and improvements
    suggestions: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    # Statistics
    statistics: Dict[str, Any] = field(default_factory=dict)


class ContentGenerator:
    """Advanced AI-powered content generator with Ollama integration"""

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "deepseek-r1:32b",
        ollama_timeout: float = 180.0,
        default_style: GenerationStyle = GenerationStyle.PROFESSIONAL,
        enable_quality_control: bool = True,
        max_retries: int = 2,
        use_advanced_prompting: bool = True,
    ):
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.ollama_model = ollama_model
        self.ollama_timeout = ollama_timeout
        self.default_style = default_style
        self.enable_quality_control = enable_quality_control
        self.max_retries = max_retries
        self.use_advanced_prompting = use_advanced_prompting
        self.logger = logging.getLogger(__name__)

        # Initialize advanced prompting for deepseek-r1:32b
        if self.use_advanced_prompting:
            from ..prompting_strategies import create_advanced_prompt_builder

            self.prompt_builder = create_advanced_prompt_builder(ollama_model)
        else:
            self.prompt_builder = None

        # Initialize content templates and style guides
        self._initialize_templates()
        self._initialize_style_guides()

        self.logger.info(
            f"ContentGenerator initialized with model: {ollama_model} (advanced prompting: {use_advanced_prompting})"
        )

    def _initialize_templates(self):
        """Initialize comprehensive content generation templates"""
        self.content_templates = {
            # Executive & Summary Content
            ContentType.EXECUTIVE_SUMMARY: {
                "structure": [
                    "project_overview",
                    "key_benefits",
                    "approach_summary",
                    "expected_outcomes",
                    "call_to_action",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "value_proposition",
                    "differentiators",
                    "roi_summary",
                    "next_steps",
                ],
                "required_context": ["project_name", "client_name", "key_benefits"],
                "style_preference": GenerationStyle.EXECUTIVE,
            },
            ContentType.EXECUTIVE_OVERVIEW: {
                "structure": [
                    "situation_summary",
                    "proposed_solution",
                    "business_impact",
                    "investment_required",
                ],
                "length_guidance": "short",
                "key_elements": [
                    "strategic_alignment",
                    "competitive_advantage",
                    "success_metrics",
                ],
                "style_preference": GenerationStyle.C_LEVEL,
            },
            ContentType.PROJECT_SUMMARY: {
                "structure": [
                    "project_purpose",
                    "scope_overview",
                    "deliverables",
                    "timeline",
                    "success_criteria",
                ],
                "length_guidance": "medium",
                "key_elements": ["objectives", "outcomes", "stakeholders"],
                "style_preference": GenerationStyle.PROFESSIONAL,
            },
            ContentType.BUSINESS_CASE: {
                "structure": [
                    "problem_definition",
                    "proposed_solution",
                    "financial_analysis",
                    "risk_assessment",
                    "recommendation",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "cost_benefit_analysis",
                    "roi_calculation",
                    "implementation_roadmap",
                ],
                "style_preference": GenerationStyle.ANALYTICAL,
            },
            ContentType.VALUE_PROPOSITION: {
                "structure": [
                    "customer_problem",
                    "unique_solution",
                    "proven_benefits",
                    "competitive_differentiation",
                ],
                "length_guidance": "short",
                "key_elements": ["pain_points", "solutions", "quantified_benefits"],
                "style_preference": GenerationStyle.BENEFIT_DRIVEN,
            },
            # Technical Content
            ContentType.TECHNICAL_OVERVIEW: {
                "structure": [
                    "technology_landscape",
                    "architecture_design",
                    "implementation_approach",
                    "technical_benefits",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "specifications",
                    "methodologies",
                    "standards_compliance",
                    "scalability",
                ],
                "required_context": ["technology_stack", "integration_requirements"],
                "style_preference": GenerationStyle.TECHNICAL,
            },
            ContentType.TECHNICAL_SPECIFICATION: {
                "structure": [
                    "functional_specifications",
                    "non_functional_requirements",
                    "interface_specifications",
                    "data_requirements",
                ],
                "length_guidance": "detailed",
                "key_elements": [
                    "performance_criteria",
                    "security_requirements",
                    "compliance_standards",
                ],
                "style_preference": GenerationStyle.SPECIFICATION,
            },
            ContentType.ARCHITECTURE_OVERVIEW: {
                "structure": [
                    "architecture_principles",
                    "system_components",
                    "integration_patterns",
                    "scalability_design",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "design_patterns",
                    "technology_choices",
                    "performance_considerations",
                ],
                "style_preference": GenerationStyle.ENGINEERING,
            },
            ContentType.SECURITY_APPROACH: {
                "structure": [
                    "security_framework",
                    "threat_analysis",
                    "protection_mechanisms",
                    "compliance_measures",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "access_control",
                    "data_protection",
                    "monitoring",
                    "incident_response",
                ],
                "style_preference": GenerationStyle.TECHNICAL_DETAILED,
            },
            # Methodology & Approach
            ContentType.APPROACH_METHODOLOGY: {
                "structure": [
                    "methodology_overview",
                    "phase_breakdown",
                    "deliverables_mapping",
                    "quality_framework",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "best_practices",
                    "risk_mitigation",
                    "success_metrics",
                    "continuous_improvement",
                ],
                "style_preference": GenerationStyle.CONSULTATIVE,
            },
            ContentType.AGILE_APPROACH: {
                "structure": [
                    "agile_principles",
                    "sprint_methodology",
                    "team_structure",
                    "delivery_cadence",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "scrum_framework",
                    "user_stories",
                    "retrospectives",
                    "continuous_delivery",
                ],
                "style_preference": GenerationStyle.COLLABORATIVE,
            },
            ContentType.QUALITY_ASSURANCE: {
                "structure": [
                    "qa_framework",
                    "testing_strategy",
                    "quality_metrics",
                    "continuous_monitoring",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "test_automation",
                    "defect_prevention",
                    "performance_testing",
                ],
                "style_preference": GenerationStyle.TECHNICAL,
            },
            ContentType.TESTING_STRATEGY: {
                "structure": [
                    "test_approach",
                    "test_levels",
                    "automation_strategy",
                    "defect_management",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "unit_testing",
                    "integration_testing",
                    "user_acceptance_testing",
                ],
                "style_preference": GenerationStyle.TECHNICAL_DETAILED,
            },
            # Project Management
            ContentType.PROJECT_TIMELINE: {
                "structure": [
                    "project_phases",
                    "major_milestones",
                    "critical_dependencies",
                    "delivery_schedule",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "deadlines",
                    "resource_allocation",
                    "risk_buffers",
                    "go_live_dates",
                ],
                "style_preference": GenerationStyle.PROFESSIONAL,
            },
            ContentType.WORK_BREAKDOWN: {
                "structure": [
                    "work_packages",
                    "task_hierarchy",
                    "effort_estimates",
                    "resource_assignments",
                ],
                "length_guidance": "long",
                "key_elements": ["deliverables", "dependencies", "assumptions"],
                "style_preference": GenerationStyle.DETAILED,
            },
            ContentType.RESOURCE_ALLOCATION: {
                "structure": [
                    "resource_requirements",
                    "skill_matrix",
                    "allocation_timeline",
                    "optimization_strategy",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "team_composition",
                    "utilization_rates",
                    "capacity_planning",
                ],
                "style_preference": GenerationStyle.ANALYTICAL,
            },
            ContentType.COMMUNICATION_PLAN: {
                "structure": [
                    "stakeholder_mapping",
                    "communication_matrix",
                    "reporting_schedule",
                    "escalation_procedures",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "meeting_cadence",
                    "status_reporting",
                    "change_notifications",
                ],
                "style_preference": GenerationStyle.PROFESSIONAL,
            },
            # Risk & Compliance
            ContentType.RISK_ASSESSMENT: {
                "structure": [
                    "risk_identification",
                    "probability_analysis",
                    "impact_assessment",
                    "mitigation_planning",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "risk_register",
                    "contingency_plans",
                    "monitoring_procedures",
                ],
                "style_preference": GenerationStyle.ANALYTICAL,
            },
            ContentType.RISK_MANAGEMENT: {
                "structure": [
                    "risk_framework",
                    "identification_process",
                    "assessment_methodology",
                    "response_strategies",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "risk_appetite",
                    "escalation_criteria",
                    "review_cycles",
                ],
                "style_preference": GenerationStyle.CONSULTATIVE,
            },
            ContentType.COMPLIANCE_APPROACH: {
                "structure": [
                    "regulatory_landscape",
                    "compliance_framework",
                    "control_mechanisms",
                    "audit_readiness",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "standards_adherence",
                    "documentation_requirements",
                    "reporting_obligations",
                ],
                "style_preference": GenerationStyle.FORMAL,
            },
            # Financial Content
            ContentType.COST_BREAKDOWN: {
                "structure": [
                    "cost_categories",
                    "resource_costs",
                    "infrastructure_costs",
                    "contingency_provisions",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "labor_costs",
                    "technology_costs",
                    "operational_expenses",
                ],
                "style_preference": GenerationStyle.ANALYTICAL,
            },
            ContentType.ROI_ANALYSIS: {
                "structure": [
                    "investment_summary",
                    "benefit_quantification",
                    "payback_calculation",
                    "sensitivity_analysis",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "cost_savings",
                    "revenue_generation",
                    "productivity_gains",
                ],
                "style_preference": GenerationStyle.FINANCIAL,
            },
            ContentType.FINANCIAL_BENEFITS: {
                "structure": [
                    "direct_savings",
                    "indirect_benefits",
                    "revenue_opportunities",
                    "long_term_value",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "quantified_benefits",
                    "realization_timeline",
                    "measurement_approach",
                ],
                "style_preference": GenerationStyle.BENEFIT_DRIVEN,
            },
            # Team & Resources
            ContentType.TEAM_OVERVIEW: {
                "structure": [
                    "team_composition",
                    "key_roles",
                    "experience_highlights",
                    "collaboration_model",
                ],
                "length_guidance": "medium",
                "key_elements": ["expertise_areas", "past_successes", "availability"],
                "style_preference": GenerationStyle.PROFESSIONAL,
            },
            ContentType.KEY_PERSONNEL: {
                "structure": [
                    "leadership_team",
                    "subject_matter_experts",
                    "key_contributors",
                    "advisory_support",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "qualifications",
                    "relevant_experience",
                    "role_responsibilities",
                ],
                "style_preference": GenerationStyle.CONSULTATIVE,
            },
            ContentType.ROLES_RESPONSIBILITIES: {
                "structure": [
                    "organizational_structure",
                    "role_definitions",
                    "accountability_matrix",
                    "decision_authority",
                ],
                "length_guidance": "long",
                "key_elements": ["responsibilities", "interfaces", "escalation_paths"],
                "style_preference": GenerationStyle.FORMAL,
            },
            # Solutions & Benefits
            ContentType.SOLUTION_OVERVIEW: {
                "structure": [
                    "solution_architecture",
                    "key_capabilities",
                    "integration_approach",
                    "user_experience",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "functional_features",
                    "technical_specifications",
                    "deployment_model",
                ],
                "style_preference": GenerationStyle.SOLUTION_FOCUSED,
            },
            ContentType.BUSINESS_BENEFITS: {
                "structure": [
                    "operational_improvements",
                    "cost_reductions",
                    "revenue_enhancements",
                    "strategic_advantages",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "quantified_benefits",
                    "realization_timeline",
                    "success_metrics",
                ],
                "style_preference": GenerationStyle.BENEFIT_DRIVEN,
            },
            ContentType.COMPETITIVE_ADVANTAGES: {
                "structure": [
                    "market_differentiation",
                    "unique_capabilities",
                    "proven_track_record",
                    "innovation_leadership",
                ],
                "length_guidance": "medium",
                "key_elements": [
                    "differentiators",
                    "competitive_positioning",
                    "value_drivers",
                ],
                "style_preference": GenerationStyle.COMPETITIVE,
            },
            # Implementation & Deployment
            ContentType.IMPLEMENTATION_PLAN: {
                "structure": [
                    "implementation_strategy",
                    "phase_approach",
                    "resource_mobilization",
                    "success_criteria",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "deployment_phases",
                    "change_management",
                    "training_program",
                ],
                "style_preference": GenerationStyle.COMPREHENSIVE,
            },
            ContentType.DEPLOYMENT_STRATEGY: {
                "structure": [
                    "deployment_approach",
                    "rollout_phases",
                    "cutover_planning",
                    "rollback_procedures",
                ],
                "length_guidance": "long",
                "key_elements": ["go_live_strategy", "user_adoption", "support_model"],
                "style_preference": GenerationStyle.TECHNICAL,
            },
            ContentType.MIGRATION_APPROACH: {
                "structure": [
                    "migration_strategy",
                    "data_migration",
                    "system_cutover",
                    "validation_procedures",
                ],
                "length_guidance": "long",
                "key_elements": [
                    "migration_tools",
                    "data_integrity",
                    "downtime_minimization",
                ],
                "style_preference": GenerationStyle.TECHNICAL_DETAILED,
            },
            # Experience & Credentials
            ContentType.COMPANY_BACKGROUND: {
                "structure": [
                    "company_overview",
                    "core_competencies",
                    "market_presence",
                    "value_philosophy",
                ],
                "length_guidance": "medium",
                "key_elements": ["history", "capabilities", "differentiators"],
                "style_preference": GenerationStyle.PROFESSIONAL,
            },
            ContentType.RELEVANT_EXPERIENCE: {
                "structure": [
                    "project_portfolio",
                    "industry_experience",
                    "technology_expertise",
                    "success_metrics",
                ],
                "length_guidance": "long",
                "key_elements": ["case_studies", "client_results", "lessons_learned"],
                "style_preference": GenerationStyle.CONSULTATIVE,
            },
            ContentType.CASE_STUDIES: {
                "structure": [
                    "client_situation",
                    "solution_delivered",
                    "implementation_approach",
                    "results_achieved",
                ],
                "length_guidance": "long",
                "key_elements": ["challenges", "solutions", "outcomes", "testimonials"],
                "style_preference": GenerationStyle.PERSUASIVE,
            },
            # Specialized Content Types
            ContentType.FAQ_SECTION: {
                "structure": [
                    "common_questions",
                    "detailed_answers",
                    "additional_resources",
                    "contact_information",
                ],
                "length_guidance": "medium",
                "key_elements": ["clear_answers", "practical_guidance", "next_steps"],
                "style_preference": GenerationStyle.FRIENDLY,
            },
            ContentType.SCOPE_OF_WORK: {
                "structure": [
                    "project_objectives",
                    "deliverables_list",
                    "activities_breakdown",
                    "acceptance_criteria",
                ],
                "length_guidance": "long",
                "key_elements": ["work_products", "timelines", "responsibilities"],
                "style_preference": GenerationStyle.FORMAL,
            },
            ContentType.SUCCESS_CRITERIA: {
                "structure": [
                    "success_definition",
                    "measurable_outcomes",
                    "acceptance_criteria",
                    "validation_approach",
                ],
                "length_guidance": "medium",
                "key_elements": ["kpis", "metrics", "benchmarks"],
                "style_preference": GenerationStyle.ANALYTICAL,
            },
        }

    def _initialize_style_guides(self):
        """Initialize comprehensive writing style guidelines"""
        self.style_guides = {
            # Business Styles
            GenerationStyle.PROFESSIONAL: {
                "tone": "formal and authoritative",
                "vocabulary": "business-appropriate with technical precision",
                "sentence_structure": "varied length with clear, direct statements",
                "formatting": "well-organized with clear headings and bullet points",
                "voice": "active voice preferred",
                "examples": "concrete business examples and case studies",
                "key_phrases": ["deliver", "ensure", "provide", "implement", "achieve"],
                "avoid": ["awesome", "cool", "stuff", "things", "guys"],
            },
            GenerationStyle.EXECUTIVE: {
                "tone": "strategic and decisive",
                "vocabulary": "high-level business terminology with strategic focus",
                "sentence_structure": "concise, impactful statements with clear priorities",
                "formatting": "executive summary format with key highlights",
                "voice": "confident and authoritative",
                "examples": "strategic outcomes and business impact",
                "key_phrases": [
                    "strategic",
                    "value creation",
                    "competitive advantage",
                    "roi",
                ],
                "focus": "bottom-line impact and strategic alignment",
            },
            GenerationStyle.CORPORATE: {
                "tone": "formal and institutional",
                "vocabulary": "corporate terminology with governance focus",
                "sentence_structure": "formal structure with policy-like clarity",
                "formatting": "structured with clear sections and subsections",
                "voice": "institutional and authoritative",
                "examples": "corporate policies and governance frameworks",
                "key_phrases": ["governance", "compliance", "framework", "policy"],
                "focus": "organizational alignment and process adherence",
            },
            GenerationStyle.CONSULTATIVE: {
                "tone": "advisory and collaborative",
                "vocabulary": "consulting terminology with solution orientation",
                "sentence_structure": "advisory tone with recommendations and insights",
                "formatting": "consulting format with insights and recommendations",
                "voice": "expert advisor with collaborative approach",
                "examples": "best practices and proven methodologies",
                "key_phrases": [
                    "recommend",
                    "best practice",
                    "proven approach",
                    "insight",
                ],
                "focus": "expert guidance and collaborative solutions",
            },
            # Technical Styles
            GenerationStyle.TECHNICAL: {
                "tone": "precise and detailed",
                "vocabulary": "technical terminology with clear explanations",
                "sentence_structure": "clear and specific with technical accuracy",
                "formatting": "structured with technical specifications and diagrams",
                "voice": "active voice with technical clarity",
                "examples": "technical specifications and implementation details",
                "key_phrases": ["implement", "configure", "integrate", "optimize"],
                "focus": "technical accuracy and implementation details",
            },
            GenerationStyle.TECHNICAL_DETAILED: {
                "tone": "comprehensive and thorough",
                "vocabulary": "extensive technical terminology with deep explanations",
                "sentence_structure": "detailed explanations with step-by-step clarity",
                "formatting": "comprehensive technical documentation format",
                "voice": "authoritative technical expert",
                "examples": "detailed technical examples with code snippets",
                "key_phrases": [
                    "specification",
                    "architecture",
                    "framework",
                    "methodology",
                ],
                "focus": "comprehensive technical coverage and depth",
            },
            GenerationStyle.ENGINEERING: {
                "tone": "systematic and logical",
                "vocabulary": "engineering terminology with design focus",
                "sentence_structure": "logical progression with design rationale",
                "formatting": "engineering documentation with design principles",
                "voice": "systematic engineering approach",
                "examples": "design patterns and engineering solutions",
                "key_phrases": ["design", "engineer", "systematic", "scalable"],
                "focus": "engineering principles and systematic design",
            },
            GenerationStyle.SPECIFICATION: {
                "tone": "precise and unambiguous",
                "vocabulary": "specification language with exact definitions",
                "sentence_structure": "precise statements with measurable criteria",
                "formatting": "formal specification format with numbered requirements",
                "voice": "definitive and exact",
                "examples": "measurable requirements and acceptance criteria",
                "key_phrases": ["shall", "must", "required", "specification"],
                "focus": "precise requirements and measurable criteria",
            },
            # Communication Styles
            GenerationStyle.PERSUASIVE: {
                "tone": "compelling and confident",
                "vocabulary": "benefit-focused with strong action words",
                "sentence_structure": "varied with powerful statements and questions",
                "formatting": "engaging with emphasis on benefits and outcomes",
                "voice": "active voice with persuasive elements",
                "examples": "success stories and compelling benefits",
                "key_phrases": ["benefit", "advantage", "opportunity", "value"],
                "focus": "compelling value proposition and call to action",
            },
            GenerationStyle.INFORMATIVE: {
                "tone": "clear and educational",
                "vocabulary": "accessible terminology with explanatory focus",
                "sentence_structure": "clear explanations with logical flow",
                "formatting": "informative structure with clear sections",
                "voice": "knowledgeable and helpful",
                "examples": "illustrative examples and explanations",
                "key_phrases": ["explain", "understand", "clarify", "demonstrate"],
                "focus": "clear information transfer and understanding",
            },
            GenerationStyle.ANALYTICAL: {
                "tone": "objective and data-driven",
                "vocabulary": "analytical terminology with metrics focus",
                "sentence_structure": "logical analysis with supporting evidence",
                "formatting": "analytical structure with data and conclusions",
                "voice": "objective analyst with evidence-based reasoning",
                "examples": "data analysis and quantitative examples",
                "key_phrases": ["analysis", "data", "metrics", "evidence"],
                "focus": "data-driven insights and objective analysis",
            },
            # Tone Styles
            GenerationStyle.FORMAL: {
                "tone": "ceremonial and respectful",
                "vocabulary": "formal language with respectful terminology",
                "sentence_structure": "formal sentence construction with proper grammar",
                "formatting": "traditional formal document structure",
                "voice": "respectful and ceremonial",
                "examples": "formal precedents and established practices",
                "key_phrases": ["respectfully", "formally", "officially", "pursuant"],
                "avoid": ["contractions", "casual language", "colloquialisms"],
            },
            GenerationStyle.AUTHORITATIVE: {
                "tone": "commanding and definitive",
                "vocabulary": "strong, decisive language with clear directives",
                "sentence_structure": "declarative statements with clear authority",
                "formatting": "authoritative structure with clear directives",
                "voice": "commanding and decisive",
                "examples": "authoritative precedents and definitive statements",
                "key_phrases": ["will", "shall", "must", "required"],
                "focus": "clear authority and definitive direction",
            },
            GenerationStyle.CONVERSATIONAL: {
                "tone": "friendly and approachable",
                "vocabulary": "accessible language with everyday terminology",
                "sentence_structure": "natural flow with conversational rhythm",
                "formatting": "approachable format with friendly structure",
                "voice": "friendly and engaging",
                "examples": "relatable examples and familiar scenarios",
                "key_phrases": ["you", "we", "let's", "together"],
                "focus": "personal connection and accessibility",
            },
            GenerationStyle.DIPLOMATIC: {
                "tone": "tactful and balanced",
                "vocabulary": "diplomatic language with balanced perspectives",
                "sentence_structure": "balanced statements with multiple viewpoints",
                "formatting": "diplomatic structure with balanced presentation",
                "voice": "tactful and balanced",
                "examples": "diplomatic solutions and balanced approaches",
                "key_phrases": ["consider", "balance", "perspective", "collaborate"],
                "focus": "balanced approach and tactful communication",
            },
            # Length & Detail Styles
            GenerationStyle.CONCISE: {
                "tone": "direct and efficient",
                "vocabulary": "clear and essential words only",
                "sentence_structure": "short to medium sentences with direct communication",
                "formatting": "bullet points and brief paragraphs",
                "voice": "active voice for clarity",
                "examples": "brief, relevant examples",
                "key_phrases": ["key", "essential", "critical", "primary"],
                "focus": "maximum information with minimum words",
            },
            GenerationStyle.COMPREHENSIVE: {
                "tone": "thorough and complete",
                "vocabulary": "extensive terminology covering all aspects",
                "sentence_structure": "detailed explanations with comprehensive coverage",
                "formatting": "complete documentation with all necessary sections",
                "voice": "thorough and authoritative",
                "examples": "comprehensive examples covering multiple scenarios",
                "key_phrases": ["comprehensive", "complete", "thorough", "extensive"],
                "focus": "complete coverage with thorough detail",
            },
            GenerationStyle.DETAILED: {
                "tone": "meticulous and specific",
                "vocabulary": "detailed terminology with specific focus",
                "sentence_structure": "specific details with step-by-step clarity",
                "formatting": "detailed format with specific sections",
                "voice": "meticulous and precise",
                "examples": "detailed examples with specific implementations",
                "key_phrases": ["specific", "detailed", "precise", "exact"],
                "focus": "specific details and precise implementation",
            },
            # Audience-Specific Styles
            GenerationStyle.C_LEVEL: {
                "tone": "strategic and executive",
                "vocabulary": "executive terminology with strategic focus",
                "sentence_structure": "strategic statements with business impact",
                "formatting": "executive briefing format with key decisions",
                "voice": "strategic executive perspective",
                "examples": "strategic outcomes and executive decisions",
                "key_phrases": ["strategic", "competitive", "market", "growth"],
                "focus": "strategic impact and executive decision-making",
            },
            GenerationStyle.MANAGEMENT: {
                "tone": "managerial and operational",
                "vocabulary": "management terminology with operational focus",
                "sentence_structure": "operational statements with management perspective",
                "formatting": "management reporting format with operational metrics",
                "voice": "managerial and operational",
                "examples": "management scenarios and operational examples",
                "key_phrases": ["manage", "coordinate", "execute", "monitor"],
                "focus": "operational management and execution",
            },
            GenerationStyle.TECHNICAL_TEAM: {
                "tone": "collaborative and technical",
                "vocabulary": "technical team terminology with implementation focus",
                "sentence_structure": "technical collaboration with implementation details",
                "formatting": "technical team documentation with implementation guides",
                "voice": "technical team collaboration",
                "examples": "technical implementation and team scenarios",
                "key_phrases": ["implement", "develop", "build", "test"],
                "focus": "technical implementation and team collaboration",
            },
            # Industry-Specific Styles
            GenerationStyle.FINANCIAL: {
                "tone": "precise and analytical",
                "vocabulary": "financial terminology with quantitative focus",
                "sentence_structure": "quantitative statements with financial analysis",
                "formatting": "financial reporting format with numerical data",
                "voice": "financial analyst perspective",
                "examples": "financial models and quantitative analysis",
                "key_phrases": ["investment", "return", "cost", "benefit"],
                "focus": "financial analysis and quantitative assessment",
            },
            GenerationStyle.HEALTHCARE: {
                "tone": "caring and professional",
                "vocabulary": "healthcare terminology with patient focus",
                "sentence_structure": "professional healthcare communication",
                "formatting": "healthcare documentation with patient-centered approach",
                "voice": "healthcare professional",
                "examples": "healthcare scenarios and patient outcomes",
                "key_phrases": ["patient", "care", "treatment", "outcome"],
                "focus": "patient care and healthcare outcomes",
            },
            GenerationStyle.GOVERNMENT: {
                "tone": "official and compliant",
                "vocabulary": "government terminology with regulatory focus",
                "sentence_structure": "official statements with regulatory compliance",
                "formatting": "government documentation with compliance structure",
                "voice": "official government perspective",
                "examples": "regulatory compliance and government processes",
                "key_phrases": ["comply", "regulate", "official", "policy"],
                "focus": "regulatory compliance and official processes",
            },
            # Proposal-Specific Styles
            GenerationStyle.COMPETITIVE: {
                "tone": "confident and differentiating",
                "vocabulary": "competitive terminology with advantage focus",
                "sentence_structure": "competitive statements with clear differentiation",
                "formatting": "competitive positioning with advantage highlights",
                "voice": "confident competitor",
                "examples": "competitive advantages and market positioning",
                "key_phrases": ["superior", "advantage", "leader", "proven"],
                "focus": "competitive differentiation and market leadership",
            },
            GenerationStyle.COLLABORATIVE: {
                "tone": "partnership-oriented and inclusive",
                "vocabulary": "collaborative terminology with partnership focus",
                "sentence_structure": "inclusive statements with partnership emphasis",
                "formatting": "collaborative format with partnership structure",
                "voice": "collaborative partner",
                "examples": "partnership scenarios and collaborative outcomes",
                "key_phrases": ["partner", "collaborate", "together", "joint"],
                "focus": "partnership development and collaborative success",
            },
            GenerationStyle.SOLUTION_FOCUSED: {
                "tone": "solution-oriented and practical",
                "vocabulary": "solution terminology with practical focus",
                "sentence_structure": "solution-oriented statements with practical application",
                "formatting": "solution documentation with practical implementation",
                "voice": "practical solution provider",
                "examples": "practical solutions and implementation scenarios",
                "key_phrases": ["solution", "solve", "address", "resolve"],
                "focus": "practical solutions and problem resolution",
            },
            GenerationStyle.BENEFIT_DRIVEN: {
                "tone": "benefit-focused and value-oriented",
                "vocabulary": "benefit terminology with value focus",
                "sentence_structure": "benefit-oriented statements with value emphasis",
                "formatting": "benefit documentation with value proposition",
                "voice": "value-focused advisor",
                "examples": "benefit realization and value creation",
                "key_phrases": ["benefit", "value", "advantage", "gain"],
                "focus": "benefit realization and value creation",
            },
            GenerationStyle.INNOVATION_FOCUSED: {
                "tone": "forward-thinking and creative",
                "vocabulary": "innovation terminology with creative focus",
                "sentence_structure": "innovative statements with creative solutions",
                "formatting": "innovation documentation with creative approaches",
                "voice": "innovative thought leader",
                "examples": "innovative solutions and creative approaches",
                "key_phrases": [
                    "innovative",
                    "creative",
                    "breakthrough",
                    "cutting-edge",
                ],
                "focus": "innovation leadership and creative solutions",
            },
        }

    async def generate_content(
        self,
        content_type: ContentType,
        context: GenerationContext,
        style: Optional[GenerationStyle] = None,
        format: ContentFormat = ContentFormat.PLAIN_TEXT,
        generate_alternatives: bool = False,
    ) -> ContentGenerationResult:
        """Generate content based on type, context, and style requirements"""
        start_time = asyncio.get_event_loop().time()
        result = ContentGenerationResult()

        try:
            if not aiohttp:
                raise ImportError("aiohttp required for content generation")

            style = style or self.default_style

            # Step 1: Build generation prompt
            prompt = await self._build_generation_prompt(
                content_type, context, style, format
            )

            # Step 2: Generate primary content
            primary_content = await self._generate_single_content(
                prompt, content_type, style, format, context
            )
            result.primary_content = primary_content
            result.model_calls += 1
            result.total_tokens_used += (
                primary_content.prompt_tokens + primary_content.completion_tokens
            )

            # Step 3: Generate alternative versions if requested
            if generate_alternatives and result.primary_content.quality_score > 0.6:
                alternatives = await self._generate_alternatives(
                    prompt, content_type, style, format, context, num_alternatives=2
                )
                result.alternative_versions = alternatives
                result.model_calls += len(alternatives)
                for alt in alternatives:
                    result.total_tokens_used += (
                        alt.prompt_tokens + alt.completion_tokens
                    )

            # Step 4: Quality assessment
            await self._assess_content_quality(result, context)

            # Step 5: Generate suggestions and improvements
            result.suggestions = await self._generate_improvement_suggestions(
                result, context
            )

            # Step 6: Compile statistics
            result.statistics = self._compile_generation_statistics(result, context)

            result.success = (
                len(result.errors) == 0 and result.primary_content is not None
            )
            result.processing_time = asyncio.get_event_loop().time() - start_time

            self.logger.info(
                f"Content generation completed: {content_type.value}, "
                f"quality: {result.primary_content.quality_score:.3f}"
                if result.primary_content
                else "failed"
            )

        except Exception as e:
            result.errors.append(f"Content generation failed: {str(e)}")
            self.logger.error(f"Content generation error: {e}")

        return result

    async def _build_generation_prompt(
        self,
        content_type: ContentType,
        context: GenerationContext,
        style: GenerationStyle,
        format: ContentFormat,
    ) -> GenerationPrompt:
        """Build comprehensive generation prompt using advanced Chain-of-Thought techniques"""
        prompt = GenerationPrompt()

        if self.use_advanced_prompting and self.prompt_builder:
            # Use Chain-of-Thought prompting for systematic content generation
            prompt.main_instruction = self._build_cot_prompt(
                content_type, context, style, format
            )
        else:
            # Fallback to basic prompting
            prompt.main_instruction = self._build_basic_prompt(
                content_type, context, style, format
            )

        return prompt

    def _build_cot_prompt(
        self,
        content_type: ContentType,
        context: GenerationContext,
        style: GenerationStyle,
        format: ContentFormat,
    ) -> str:
        """Build Chain-of-Thought prompt for systematic content generation"""

        # Define reasoning steps based on content type
        reasoning_steps = self._get_cot_reasoning_steps(content_type)

        # Build context information
        context_info = self._build_context_string(context)

        # Create Chain-of-Thought prompt
        task = f"Generate high-quality {content_type.value.replace('_', ' ')} content that is {style.value} in style and formatted as {format.value}"

        cot_prompt = create_chain_of_thought_prompt(
            task=task,
            context=context_info,
            reasoning_steps=reasoning_steps,
            output_format=self._get_output_format_instructions(format),
            examples=self._get_content_examples(content_type),
        )

        return cot_prompt

    def _build_basic_prompt(
        self,
        content_type: ContentType,
        context: GenerationContext,
        style: GenerationStyle,
        format: ContentFormat,
    ) -> str:
        """Build basic prompt (fallback when advanced prompting disabled)"""
        if content_type == ContentType.EXECUTIVE_SUMMARY:
            return f"""Generate a compelling executive summary for a {context.document_type} that captures the key value proposition and benefits."""

        elif content_type == ContentType.TECHNICAL_OVERVIEW:
            return f"""Create a comprehensive technical overview that explains the technology approach, architecture, and implementation methodology."""

        elif content_type == ContentType.APPROACH_METHODOLOGY:
            return f"""Develop a detailed approach and methodology section that outlines the project execution strategy, phases, and deliverables."""

        elif content_type == ContentType.PROJECT_TIMELINE:
            return f"""Create a project timeline that shows phases, milestones, and key dependencies with realistic scheduling."""

        elif content_type == ContentType.RISK_ASSESSMENT:
            return f"""Generate a thorough risk assessment that identifies potential risks, analyzes their impact, and provides mitigation strategies."""

        else:
            return f"""Generate high-quality content for {content_type.value.replace("_", " ")} that meets the specified requirements."""

    def _get_cot_reasoning_steps(self, content_type: ContentType) -> List[str]:
        """Get Chain-of-Thought reasoning steps for specific content types"""

        base_steps = [
            "Analyze the requirements and understand the target audience",
            "Identify key information and value propositions to communicate",
            "Structure the content for maximum impact and clarity",
            "Apply appropriate tone and style for the context",
            "Generate compelling and accurate content",
            "Review and refine for quality and effectiveness",
        ]

        content_specific_steps = {
            ContentType.EXECUTIVE_SUMMARY: [
                "Understand the project scope and business context",
                "Identify the core value proposition and key benefits",
                "Analyze the target executive audience and their priorities",
                "Structure: situation, solution, benefits, next steps",
                "Craft compelling opening that captures attention",
                "Summarize complex technical details in business terms",
                "End with clear call-to-action and next steps",
            ],
            ContentType.TECHNICAL_OVERVIEW: [
                "Analyze technical requirements and constraints",
                "Understand the technical audience and their expertise level",
                "Identify key technologies, architectures, and approaches",
                "Structure: current state, proposed solution, implementation",
                "Explain technical concepts clearly and accurately",
                "Address scalability, security, and performance considerations",
                "Provide technical justification for approach",
            ],
            ContentType.RISK_ASSESSMENT: [
                "Identify potential project risks across all dimensions",
                "Analyze probability and impact of each risk",
                "Categorize risks by type (technical, business, operational)",
                "Develop mitigation strategies for high-priority risks",
                "Consider interdependencies between risks",
                "Present risks in order of priority with clear action plans",
                "Include monitoring and contingency approaches",
            ],
            ContentType.ROI_ANALYSIS: [
                "Identify all relevant costs (direct, indirect, opportunity)",
                "Quantify benefits in financial and strategic terms",
                "Analyze timeframes for cost recovery and benefit realization",
                "Consider risk factors that could impact costs or benefits",
                "Compare against alternative approaches or status quo",
                "Present clear ROI calculations and business case",
                "Address assumptions and sensitivity analysis",
            ],
        }

        return content_specific_steps.get(content_type, base_steps)

    def _build_context_string(self, context: GenerationContext) -> str:
        """Build context information string"""
        context_parts = []

        if context.project_name:
            context_parts.append(f"Project: {context.project_name}")

        if context.client_name:
            context_parts.append(f"Client: {context.client_name}")

        if context.industry:
            context_parts.append(f"Industry: {context.industry}")

        if context.key_points:
            context_parts.append(
                f"Key points to address: {', '.join(context.key_points)}"
            )

        if context.requirements:
            context_parts.append(f"Requirements: {', '.join(context.requirements)}")

        if context.existing_content:
            context_parts.append(
                f"Existing content context: {context.existing_content[:500]}"
            )

        return (
            "\n".join(context_parts)
            if context_parts
            else "No specific context provided"
        )

    def _get_output_format_instructions(self, format: ContentFormat) -> str:
        """Get format-specific output instructions"""
        format_instructions = {
            ContentFormat.PLAIN_TEXT: "Provide clean, well-structured plain text without formatting",
            ContentFormat.MARKDOWN: "Use proper Markdown formatting with headers, lists, and emphasis",
            ContentFormat.STRUCTURED_JSON: "Return structured JSON with relevant fields and hierarchical organization",
            ContentFormat.BULLET_LIST: "Present information as a bulleted list with clear, concise points",
            ContentFormat.NUMBERED_LIST: "Structure as a numbered list with logical sequence",
            ContentFormat.PARAGRAPH_FORM: "Write in well-developed paragraph form with smooth transitions",
        }
        return format_instructions.get(
            format, "Use appropriate formatting for the content"
        )

    def _get_content_examples(self, content_type: ContentType) -> List[Dict[str, str]]:
        """Get examples for specific content types"""

        examples = {
            ContentType.EXECUTIVE_SUMMARY: [
                {
                    "input": "Software modernization project for financial services client",
                    "reasoning": "First analyze business context, then identify value proposition, structure for executive audience",
                    "output": "Executive Summary example focusing on ROI, risk reduction, and strategic benefits",
                }
            ],
            ContentType.RISK_ASSESSMENT: [
                {
                    "input": "Cloud migration project with regulatory requirements",
                    "reasoning": "Identify technical, compliance, and business risks; analyze probability and impact; develop mitigation strategies",
                    "output": "Risk matrix with high-priority risks, mitigation strategies, and monitoring approaches",
                }
            ],
        }

        return examples.get(content_type, [])

    async def _generate_single_content(
        self,
        prompt: GenerationPrompt,
        content_type: ContentType,
        style: GenerationStyle,
        format: ContentFormat,
        context: GenerationContext,
    ) -> GeneratedContent:
        """Generate a single piece of content"""
        content = GeneratedContent()
        content.content_type = content_type
        content.format = format
        content.model_used = self.ollama_model

        # Construct full prompt
        full_prompt = f"""{prompt.main_instruction}

Context Information:
{prompt.context_information}

{prompt.style_guidelines}

Format Requirements:
{prompt.format_requirements}

{prompt.quality_criteria}

Please generate the content now:"""

        # Generation parameters
        generation_params = {
            "temperature": 0.7,
            "top_p": 0.9,
            "num_predict": 800 if context.length_requirement == "long" else 500,
        }

        if style == GenerationStyle.TECHNICAL:
            generation_params["temperature"] = (
                0.3  # More deterministic for technical content
            )
        elif style == GenerationStyle.PERSUASIVE:
            generation_params["temperature"] = (
                0.8  # More creative for persuasive content
            )

        content.generation_parameters = generation_params

        # Make API call to Ollama
        timeout = ClientTimeout(total=self.ollama_timeout)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{self.ollama_base_url}/api/generate",
                json={
                    "model": self.ollama_model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": generation_params,
                },
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    generated_text = result.get("response", "").strip()

                    # Filter thinking tags for deepseek-r1:32b responses
                    if (
                        self.use_advanced_prompting
                        and "deepseek-r1" in self.ollama_model
                    ):
                        generated_text = filter_thinking_tags(generated_text)

                    content.content = generated_text
                    content.word_count = len(generated_text.split())
                    content.estimated_reading_time = (
                        content.word_count / 200
                    )  # Average reading speed

                    # Estimate token usage (rough approximation)
                    content.prompt_tokens = (
                        len(full_prompt.split()) * 1.3
                    )  # Rough token estimate
                    content.completion_tokens = len(generated_text.split()) * 1.3

                    # Basic quality assessment
                    content.quality_score = await self._assess_single_content_quality(
                        generated_text, context
                    )
                    content.style_score = await self._assess_style_consistency(
                        generated_text, style
                    )

                else:
                    raise Exception(f"Ollama API error: {response.status}")

        return content

    async def _generate_alternatives(
        self,
        prompt: GenerationPrompt,
        content_type: ContentType,
        style: GenerationStyle,
        format: ContentFormat,
        context: GenerationContext,
        num_alternatives: int = 2,
    ) -> List[GeneratedContent]:
        """Generate alternative versions of content"""
        alternatives = []

        # Modify prompt slightly for variations
        variation_prompts = [
            "Create a slightly different version with varied phrasing and structure:",
            "Generate an alternative approach with different emphasis and examples:",
            "Provide another version with alternative organization and flow:",
        ]

        for i in range(min(num_alternatives, len(variation_prompts))):
            try:
                # Modify the main instruction for variation
                varied_prompt = GenerationPrompt()
                varied_prompt.main_instruction = (
                    f"{variation_prompts[i]}\n\n{prompt.main_instruction}"
                )
                varied_prompt.context_information = prompt.context_information
                varied_prompt.style_guidelines = prompt.style_guidelines
                varied_prompt.format_requirements = prompt.format_requirements
                varied_prompt.quality_criteria = prompt.quality_criteria

                alternative = await self._generate_single_content(
                    varied_prompt, content_type, style, format, context
                )
                alternatives.append(alternative)

            except Exception as e:
                self.logger.warning(f"Failed to generate alternative {i + 1}: {e}")

        return alternatives

    async def _assess_content_quality(
        self, result: ContentGenerationResult, context: GenerationContext
    ):
        """Assess overall content quality"""
        if not result.primary_content:
            return

        content = result.primary_content.content

        # Coherence assessment (basic text flow analysis)
        sentences = re.split(r"[.!?]+", content)
        sentences = [s.strip() for s in sentences if s.strip()]

        if len(sentences) > 1:
            # Simple coherence check based on sentence connections
            coherence_score = 0.7  # Base score

            # Check for transition words
            transition_words = [
                "however",
                "therefore",
                "furthermore",
                "additionally",
                "moreover",
                "consequently",
            ]
            transition_count = sum(
                1
                for sentence in sentences
                for word in transition_words
                if word in sentence.lower()
            )

            if transition_count > 0:
                coherence_score += min(transition_count * 0.1, 0.2)

            result.coherence_score = min(coherence_score, 1.0)
        else:
            result.coherence_score = 0.5

        # Relevance assessment
        relevance_score = 0.6  # Base score

        # Check if key points are addressed
        if context.key_points:
            addressed_points = 0
            for key_point in context.key_points:
                if key_point.lower() in content.lower():
                    addressed_points += 1

            if context.key_points:
                relevance_score += (addressed_points / len(context.key_points)) * 0.3

        # Check if requirements are addressed
        if context.requirements:
            addressed_reqs = 0
            for requirement in context.requirements:
                if requirement.lower() in content.lower():
                    addressed_reqs += 1

            if context.requirements:
                relevance_score += (addressed_reqs / len(context.requirements)) * 0.1

        result.relevance_score = min(relevance_score, 1.0)

        # Completeness assessment
        word_count = result.primary_content.word_count
        target_range = self._get_target_word_range(context)

        if target_range[0] <= word_count <= target_range[1]:
            result.completeness_score = 1.0
        elif word_count < target_range[0]:
            result.completeness_score = max(word_count / target_range[0], 0.3)
        else:
            # Slightly penalize for being too long
            result.completeness_score = max(
                1.0 - (word_count - target_range[1]) / target_range[1] * 0.5, 0.5
            )

        # Style consistency (from individual assessment)
        result.style_consistency = result.primary_content.style_score

    def _get_target_word_range(self, context: GenerationContext) -> tuple:
        """Get target word count range based on context"""
        if context.word_count_target:
            # Allow 20% variance around target
            variance = int(context.word_count_target * 0.2)
            return (
                context.word_count_target - variance,
                context.word_count_target + variance,
            )

        # Default ranges based on length requirement
        ranges = {
            "short": (100, 200),
            "medium": (200, 400),
            "long": (400, 800),
            "custom": (200, 400),
        }

        return ranges.get(context.length_requirement, (200, 400))

    async def _assess_single_content_quality(
        self, content: str, context: GenerationContext
    ) -> float:
        """Assess quality of a single piece of content"""
        quality_factors = []

        # Length appropriateness
        word_count = len(content.split())
        target_range = self._get_target_word_range(context)

        if target_range[0] <= word_count <= target_range[1]:
            quality_factors.append(1.0)
        else:
            # Penalty for being outside range
            if word_count < target_range[0]:
                quality_factors.append(max(word_count / target_range[0], 0.4))
            else:
                quality_factors.append(
                    max(
                        1.0 - (word_count - target_range[1]) / target_range[1] * 0.3,
                        0.6,
                    )
                )

        # Structure quality (basic checks)
        structure_score = 0.7  # Base score

        # Check for paragraph breaks
        if "\n" in content:
            structure_score += 0.1

        # Check for varied sentence length
        sentences = re.split(r"[.!?]+", content)
        sentence_lengths = [len(s.split()) for s in sentences if s.strip()]

        if sentence_lengths:
            avg_length = sum(sentence_lengths) / len(sentence_lengths)
            if 10 <= avg_length <= 20:  # Good range
                structure_score += 0.1

        quality_factors.append(min(structure_score, 1.0))

        # Content relevance (keyword matching)
        relevance_score = 0.6  # Base score

        content_lower = content.lower()

        if context.key_points:
            relevant_points = sum(
                1 for point in context.key_points if point.lower() in content_lower
            )
            relevance_score += (relevant_points / len(context.key_points)) * 0.3

        if context.project_name and context.project_name.lower() in content_lower:
            relevance_score += 0.1

        quality_factors.append(min(relevance_score, 1.0))

        return sum(quality_factors) / len(quality_factors)

    async def _assess_style_consistency(
        self, content: str, style: GenerationStyle
    ) -> float:
        """Assess style consistency of generated content"""
        style_score = 0.7  # Base score
        content_lower = content.lower()

        # Style-specific checks
        if style == GenerationStyle.PROFESSIONAL:
            # Check for professional language
            professional_indicators = [
                "deliver",
                "provide",
                "ensure",
                "develop",
                "implement",
                "achieve",
            ]
            indicator_count = sum(
                1 for indicator in professional_indicators if indicator in content_lower
            )
            style_score += min(indicator_count * 0.05, 0.2)

        elif style == GenerationStyle.TECHNICAL:
            # Check for technical precision
            technical_indicators = [
                "system",
                "process",
                "method",
                "approach",
                "technology",
                "solution",
            ]
            indicator_count = sum(
                1 for indicator in technical_indicators if indicator in content_lower
            )
            style_score += min(indicator_count * 0.05, 0.2)

        elif style == GenerationStyle.PERSUASIVE:
            # Check for persuasive elements
            persuasive_indicators = [
                "benefit",
                "advantage",
                "opportunity",
                "value",
                "improvement",
                "success",
            ]
            indicator_count = sum(
                1 for indicator in persuasive_indicators if indicator in content_lower
            )
            style_score += min(indicator_count * 0.05, 0.2)

        # General style quality checks
        sentences = re.split(r"[.!?]+", content)
        sentences = [s.strip() for s in sentences if s.strip()]

        # Check sentence variety
        if len(sentences) > 1:
            sentence_lengths = [len(s.split()) for s in sentences]
            if len(set(sentence_lengths)) > len(sentence_lengths) * 0.3:  # Good variety
                style_score += 0.1

        return min(style_score, 1.0)

    async def _generate_improvement_suggestions(
        self, result: ContentGenerationResult, context: GenerationContext
    ) -> List[str]:
        """Generate suggestions for content improvement"""
        suggestions = []

        if not result.primary_content:
            return suggestions

        content = result.primary_content.content

        # Length-based suggestions
        word_count = result.primary_content.word_count
        target_range = self._get_target_word_range(context)

        if word_count < target_range[0]:
            suggestions.append(
                f"Consider expanding content (currently {word_count} words, target: {target_range[0]}-{target_range[1]})"
            )
        elif word_count > target_range[1]:
            suggestions.append(
                f"Consider condensing content (currently {word_count} words, target: {target_range[0]}-{target_range[1]})"
            )

        # Quality-based suggestions
        if result.coherence_score < 0.7:
            suggestions.append("Improve logical flow and transitions between ideas")

        if result.relevance_score < 0.7:
            suggestions.append(
                "Better address the specified requirements and key points"
            )

        if result.style_consistency < 0.7:
            suggestions.append("Enhance style consistency throughout the content")

        # Context-specific suggestions
        if context.key_points:
            content_lower = content.lower()
            unaddressed_points = [
                point
                for point in context.key_points
                if point.lower() not in content_lower
            ]

            if unaddressed_points:
                suggestions.append(
                    f"Address missing key points: {', '.join(unaddressed_points[:3])}"
                )

        # Structure suggestions
        if "\n" not in content and len(content.split()) > 150:
            suggestions.append("Add paragraph breaks to improve readability")

        # Style-specific suggestions
        if context.use_active_voice and "was" in content.lower():
            suggestions.append("Consider using more active voice constructions")

        return suggestions[:6]  # Limit to 6 suggestions

    def _compile_generation_statistics(
        self, result: ContentGenerationResult, context: GenerationContext
    ) -> Dict[str, Any]:
        """Compile comprehensive generation statistics"""
        stats = {
            "generation_summary": {
                "success": result.success,
                "content_generated": result.primary_content is not None,
                "alternatives_generated": len(result.alternative_versions),
                "total_model_calls": result.model_calls,
                "total_tokens_used": result.total_tokens_used,
                "processing_time": result.processing_time,
            }
        }

        if result.primary_content:
            stats["content_metrics"] = {
                "word_count": result.primary_content.word_count,
                "estimated_reading_time": result.primary_content.estimated_reading_time,
                "content_type": result.primary_content.content_type.value,
                "format": result.primary_content.format.value,
            }

            stats["quality_scores"] = {
                "overall_quality": result.primary_content.quality_score,
                "style_consistency": result.primary_content.style_score,
                "coherence": result.coherence_score,
                "relevance": result.relevance_score,
                "completeness": result.completeness_score,
            }

        stats["context_analysis"] = {
            "key_points_provided": len(context.key_points),
            "requirements_provided": len(context.requirements),
            "target_audience": context.target_audience,
            "length_requirement": context.length_requirement,
            "style_preferences": {
                "include_examples": context.include_examples,
                "include_benefits": context.include_benefits,
                "use_active_voice": context.use_active_voice,
                "avoid_jargon": context.avoid_jargon,
            },
        }

        return stats

    async def expand_outline(
        self,
        outline: List[str],
        context: GenerationContext,
        style: Optional[GenerationStyle] = None,
    ) -> ContentGenerationResult:
        """Expand an outline into full content"""
        # Convert outline to context for generation
        expanded_context = GenerationContext()
        expanded_context.__dict__.update(context.__dict__)
        expanded_context.key_points = outline

        return await self.generate_content(
            ContentType.CUSTOM_CONTENT,
            expanded_context,
            style,
            ContentFormat.PARAGRAPH_FORM,
        )

    async def generate_bullet_points(
        self, topic: str, context: GenerationContext, num_points: int = 5
    ) -> ContentGenerationResult:
        """Generate bullet points for a specific topic"""
        bullet_context = GenerationContext()
        bullet_context.__dict__.update(context.__dict__)
        bullet_context.key_points = [topic]
        bullet_context.length_requirement = "short"
        bullet_context.word_count_target = num_points * 20  # Rough estimate

        return await self.generate_content(
            ContentType.BULLET_POINTS,
            bullet_context,
            GenerationStyle.CONCISE,
            ContentFormat.BULLET_LIST,
        )

    async def enhance_existing_content(
        self, existing_content: str, enhancement_type: str, context: GenerationContext
    ) -> ContentGenerationResult:
        """Enhance existing content with improvements"""
        enhancement_context = GenerationContext()
        enhancement_context.__dict__.update(context.__dict__)
        enhancement_context.existing_content = existing_content
        enhancement_context.key_points = [f"enhance_for_{enhancement_type}"]

        return await self.generate_content(
            ContentType.PARAGRAPH_EXPANSION,
            enhancement_context,
            GenerationStyle.PROFESSIONAL,
            ContentFormat.PARAGRAPH_FORM,
        )

    def get_generator_info(self) -> Dict[str, Any]:
        """Get comprehensive generator information"""
        return {
            "generator_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "supported_content_types": [
                content_type.value for content_type in ContentType
            ],
            "supported_styles": [style.value for style in GenerationStyle],
            "supported_formats": [format.value for format in ContentFormat],
            "features": {
                "content_generation": True,
                "alternative_versions": True,
                "quality_assessment": self.enable_quality_control,
                "style_consistency": True,
                "context_awareness": True,
                "improvement_suggestions": True,
            },
            "configuration": {
                "default_style": self.default_style.value,
                "quality_control_enabled": self.enable_quality_control,
                "max_retries": self.max_retries,
                "timeout": self.ollama_timeout,
            },
        }

    async def close(self):
        """Close generator and cleanup resources"""
        self.logger.info("ContentGenerator closed")


# Factory function
def create_content_generator(
    config: Optional[Dict[str, Any]] = None,
) -> ContentGenerator:
    """Create ContentGenerator instance with configuration"""
    if config is None:
        config = {}

    default_style = config.get("default_style", "professional")
    if isinstance(default_style, str):
        default_style = GenerationStyle(default_style)

    return ContentGenerator(
        ollama_base_url=config.get("ollama_base_url", "http://localhost:11434"),
        ollama_model=config.get("ollama_model", "deepseek-r1:32b"),
        ollama_timeout=config.get("ollama_timeout", 180.0),
        default_style=default_style,
        enable_quality_control=config.get("enable_quality_control", True),
        max_retries=config.get("max_retries", 2),
    )
