"""
Agent Roles and Capabilities System

Defines agent roles, capabilities, and goals for specialized behavior
in the multi-agent proposal generation system.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from typing import Any, Dict, List, Optional, Set, Union
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str
class AgentRole(str, Enum):
	"""Predefined agent roles in the proposal system"""
	
	# Core operational roles
	RESEARCHER = "researcher"
	WRITER = "writer"
	REVIEWER = "reviewer"
	COORDINATOR = "coordinator"
	ANALYST = "analyst"
	QUALITY_ASSURER = "quality_assurer"
	
	# Specialized roles
	CONTENT_STRATEGIST = "content_strategist"
	TECHNICAL_EXPERT = "technical_expert"
	COMPLIANCE_CHECKER = "compliance_checker"
	VOICE_CONSULTANT = "voice_consultant"
	DATA_ANALYST = "data_analyst"
	PROJECT_MANAGER = "project_manager"
	
	# Support roles
	KNOWLEDGE_MANAGER = "knowledge_manager"
	COMMUNICATION_FACILITATOR = "communication_facilitator"
	TASK_SCHEDULER = "task_scheduler"
	RESOURCE_ALLOCATOR = "resource_allocator"

class AgentCapability(str, Enum):
	"""Individual capabilities that agents can possess"""
	
	# Research capabilities
	WEB_RESEARCH = "web_research"
	DOCUMENT_ANALYSIS = "document_analysis"
	DATA_GATHERING = "data_gathering"
	COMPETITIVE_ANALYSIS = "competitive_analysis"
	MARKET_RESEARCH = "market_research"
	TECHNICAL_RESEARCH = "technical_research"
	
	# Writing capabilities
	CONTENT_CREATION = "content_creation"
	TECHNICAL_WRITING = "technical_writing"
	CREATIVE_WRITING = "creative_writing"
	EXECUTIVE_SUMMARY = "executive_summary"
	PROPOSAL_WRITING = "proposal_writing"
	DOCUMENTATION = "documentation"
	
	# Analysis capabilities
	DATA_ANALYSIS = "data_analysis"
	STATISTICAL_ANALYSIS = "statistical_analysis"
	FINANCIAL_ANALYSIS = "financial_analysis"
	RISK_ANALYSIS = "risk_analysis"
	TREND_ANALYSIS = "trend_analysis"
	PERFORMANCE_ANALYSIS = "performance_analysis"
	
	# Quality and review
	CONTENT_REVIEW = "content_review"
	QUALITY_ASSURANCE = "quality_assurance"
	FACT_CHECKING = "fact_checking"
	COMPLIANCE_REVIEW = "compliance_review"
	VOICE_ANALYSIS = "voice_analysis"
	STYLE_CHECKING = "style_checking"
	
	# Coordination and management
	PROJECT_COORDINATION = "project_coordination"
	TASK_SCHEDULING = "task_scheduling"
	RESOURCE_MANAGEMENT = "resource_management"
	WORKFLOW_OPTIMIZATION = "workflow_optimization"
	TEAM_COORDINATION = "team_coordination"
	
	# Communication
	STAKEHOLDER_COMMUNICATION = "stakeholder_communication"
	CROSS_TEAM_COLLABORATION = "cross_team_collaboration"
	CLIENT_INTERACTION = "client_interaction"
	PRESENTATION_SKILLS = "presentation_skills"
	
	# Technical capabilities
	API_INTEGRATION = "api_integration"
	DATA_PROCESSING = "data_processing"
	AUTOMATION = "automation"
	SYSTEM_INTEGRATION = "system_integration"
	
	# Domain expertise
	BUSINESS_STRATEGY = "business_strategy"
	TECHNOLOGY_EXPERTISE = "technology_expertise"
	INDUSTRY_KNOWLEDGE = "industry_knowledge"
	REGULATORY_KNOWLEDGE = "regulatory_knowledge"
	FINANCIAL_EXPERTISE = "financial_expertise"

class AgentGoal(str, Enum):
	"""Goal types that agents can pursue"""
	
	# Performance goals
	TASK_COMPLETION = "task_completion"
	QUALITY_EXCELLENCE = "quality_excellence"
	EFFICIENCY_OPTIMIZATION = "efficiency_optimization"
	RESPONSE_TIME = "response_time"
	ACCURACY_IMPROVEMENT = "accuracy_improvement"
	
	# Collaboration goals
	TEAM_SYNERGY = "team_synergy"
	KNOWLEDGE_SHARING = "knowledge_sharing"
	COMMUNICATION_EXCELLENCE = "communication_excellence"
	CONFLICT_RESOLUTION = "conflict_resolution"
	
	# Learning goals
	SKILL_DEVELOPMENT = "skill_development"
	KNOWLEDGE_ACQUISITION = "knowledge_acquisition"
	ADAPTATION = "adaptation"
	CONTINUOUS_IMPROVEMENT = "continuous_improvement"
	
	# Business goals
	CLIENT_SATISFACTION = "client_satisfaction"
	PROPOSAL_WIN_RATE = "proposal_win_rate"
	COST_OPTIMIZATION = "cost_optimization"
	INNOVATION = "innovation"
	COMPETITIVE_ADVANTAGE = "competitive_advantage"

class CapabilityLevel(str, Enum):
	"""Skill levels for capabilities"""
	NOVICE = "novice"
	INTERMEDIATE = "intermediate"
	ADVANCED = "advanced"
	EXPERT = "expert"
	MASTER = "master"

class GoalPriority(str, Enum):
	"""Priority levels for goals"""
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"
	OPTIONAL = "optional"

class CapabilityDefinition(BaseModel):
	"""Definition of an agent capability"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	capability: AgentCapability
	level: CapabilityLevel = CapabilityLevel.INTERMEDIATE
	proficiency_score: float = Field(ge=0.0, le=1.0, default=0.7)
	description: str = Field(description="Description of this capability")
	required_tools: List[str] = Field(default_factory=list)
	prerequisite_capabilities: List[AgentCapability] = Field(default_factory=list)
	experience_points: int = Field(default=0, ge=0)
	last_used: Optional[datetime] = None
	success_rate: float = Field(ge=0.0, le=1.0, default=1.0)
	improvement_rate: float = Field(ge=0.0, default=0.01)

class GoalDefinition(BaseModel):
	"""Definition of an agent goal"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	goal_id: str = Field(default_factory=uuid7str)
	goal_type: AgentGoal
	priority: GoalPriority = GoalPriority.MEDIUM
	description: str = Field(description="Detailed goal description")
	target_value: float = Field(ge=0.0, default=1.0)
	current_progress: float = Field(ge=0.0, default=0.0)
	success_criteria: Dict[str, Any] = Field(default_factory=dict)
	deadline: Optional[datetime] = None
	created_at: datetime = Field(default_factory=datetime.now)
	last_updated: datetime = Field(default_factory=datetime.now)
	is_active: bool = True
	completion_reward: float = Field(ge=0.0, default=1.0)
	failure_penalty: float = Field(ge=0.0, default=0.1)

class RoleDefinition(BaseModel):
	"""Complete definition of an agent role"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	role: AgentRole
	name: str = Field(description="Human-readable role name")
	description: str = Field(description="Detailed role description")
	
	# Core attributes
	primary_capabilities: List[CapabilityDefinition] = Field(default_factory=list)
	secondary_capabilities: List[CapabilityDefinition] = Field(default_factory=list)
	default_goals: List[GoalDefinition] = Field(default_factory=list)
	
	# Behavioral characteristics
	autonomy_level: float = Field(ge=0.0, le=1.0, default=0.7, description="Level of autonomous decision-making")
	collaboration_preference: float = Field(ge=0.0, le=1.0, default=0.8, description="Preference for collaborative work")
	risk_tolerance: float = Field(ge=0.0, le=1.0, default=0.5, description="Tolerance for risky decisions")
	creativity_factor: float = Field(ge=0.0, le=1.0, default=0.5, description="Tendency toward creative solutions")
	detail_orientation: float = Field(ge=0.0, le=1.0, default=0.7, description="Focus on details vs big picture")
	communication_style: str = Field(default="professional", description="Preferred communication style")
	
	# Operational parameters
	max_concurrent_tasks: int = Field(default=3, ge=1, le=10)
	task_switching_cost: float = Field(ge=0.0, le=1.0, default=0.1, description="Penalty for switching between tasks")
	learning_rate: float = Field(ge=0.0, le=1.0, default=0.05, description="Rate of skill improvement")
	specialization_domains: List[str] = Field(default_factory=list)
	
	# Interaction patterns
	preferred_collaborators: List[AgentRole] = Field(default_factory=list)
	communication_frequency: Dict[str, int] = Field(default_factory=dict)
	escalation_triggers: Dict[str, float] = Field(default_factory=dict)

# Predefined role configurations
ROLE_DEFINITIONS = {
	AgentRole.RESEARCHER: RoleDefinition(
		role=AgentRole.RESEARCHER,
		name="Research Specialist",
		description="Conducts comprehensive research and gathers relevant information for proposals",
		primary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.WEB_RESEARCH,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.9,
				description="Expert web research and information gathering"
			),
			CapabilityDefinition(
				capability=AgentCapability.DATA_GATHERING,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.85,
				description="Advanced data collection and organization"
			),
			CapabilityDefinition(
				capability=AgentCapability.DOCUMENT_ANALYSIS,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.8,
				description="Analysis of existing documents and materials"
			)
		],
		secondary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.COMPETITIVE_ANALYSIS,
				level=CapabilityLevel.INTERMEDIATE,
				proficiency_score=0.7,
				description="Competitive landscape analysis"
			)
		],
		default_goals=[
			GoalDefinition(
				goal_type=AgentGoal.ACCURACY_IMPROVEMENT,
				priority=GoalPriority.HIGH,
				description="Maintain high accuracy in research findings",
				target_value=0.95
			),
			GoalDefinition(
				goal_type=AgentGoal.EFFICIENCY_OPTIMIZATION,
				priority=GoalPriority.MEDIUM,
				description="Optimize research efficiency and speed",
				target_value=0.8
			)
		],
		autonomy_level=0.8,
		collaboration_preference=0.6,
		creativity_factor=0.6,
		detail_orientation=0.9,
		specialization_domains=["market_research", "competitive_intelligence", "data_analysis"]
	),
	
	AgentRole.WRITER: RoleDefinition(
		role=AgentRole.WRITER,
		name="Content Writer",
		description="Creates compelling proposal content and documentation",
		primary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.CONTENT_CREATION,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.95,
				description="Expert content creation and writing"
			),
			CapabilityDefinition(
				capability=AgentCapability.PROPOSAL_WRITING,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.9,
				description="Specialized proposal writing expertise"
			),
			CapabilityDefinition(
				capability=AgentCapability.TECHNICAL_WRITING,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.8,
				description="Technical documentation and writing"
			)
		],
		secondary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.CREATIVE_WRITING,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.75,
				description="Creative and engaging content creation"
			)
		],
		default_goals=[
			GoalDefinition(
				goal_type=AgentGoal.QUALITY_EXCELLENCE,
				priority=GoalPriority.CRITICAL,
				description="Maintain excellent writing quality standards",
				target_value=0.9
			),
			GoalDefinition(
				goal_type=AgentGoal.CLIENT_SATISFACTION,
				priority=GoalPriority.HIGH,
				description="Ensure client satisfaction with written content",
				target_value=0.85
			)
		],
		autonomy_level=0.7,
		collaboration_preference=0.8,
		creativity_factor=0.9,
		detail_orientation=0.8,
		specialization_domains=["proposal_writing", "content_strategy", "brand_voice"]
	),
	
	AgentRole.REVIEWER: RoleDefinition(
		role=AgentRole.REVIEWER,
		name="Quality Reviewer",
		description="Reviews and improves content quality and compliance",
		primary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.CONTENT_REVIEW,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.95,
				description="Expert content review and editing"
			),
			CapabilityDefinition(
				capability=AgentCapability.QUALITY_ASSURANCE,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.9,
				description="Quality assurance and standards enforcement"
			),
			CapabilityDefinition(
				capability=AgentCapability.FACT_CHECKING,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.85,
				description="Fact verification and accuracy checking"
			)
		],
		secondary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.COMPLIANCE_REVIEW,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.8,
				description="Compliance and regulatory review"
			)
		],
		default_goals=[
			GoalDefinition(
				goal_type=AgentGoal.QUALITY_EXCELLENCE,
				priority=GoalPriority.CRITICAL,
				description="Ensure highest quality standards in all reviews",
				target_value=0.95
			),
			GoalDefinition(
				goal_type=AgentGoal.ACCURACY_IMPROVEMENT,
				priority=GoalPriority.HIGH,
				description="Maintain high accuracy in quality assessments",
				target_value=0.9
			)
		],
		autonomy_level=0.6,
		collaboration_preference=0.9,
		creativity_factor=0.4,
		detail_orientation=0.95,
		specialization_domains=["quality_assurance", "compliance", "content_optimization"]
	),
	
	AgentRole.COORDINATOR: RoleDefinition(
		role=AgentRole.COORDINATOR,
		name="Project Coordinator",
		description="Coordinates team activities and manages workflow",
		primary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.PROJECT_COORDINATION,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.9,
				description="Expert project coordination and management"
			),
			CapabilityDefinition(
				capability=AgentCapability.TASK_SCHEDULING,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.85,
				description="Advanced task scheduling and prioritization"
			),
			CapabilityDefinition(
				capability=AgentCapability.TEAM_COORDINATION,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.9,
				description="Team coordination and collaboration facilitation"
			)
		],
		secondary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.RESOURCE_MANAGEMENT,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.75,
				description="Resource allocation and management"
			)
		],
		default_goals=[
			GoalDefinition(
				goal_type=AgentGoal.TEAM_SYNERGY,
				priority=GoalPriority.CRITICAL,
				description="Maintain high team collaboration and synergy",
				target_value=0.9
			),
			GoalDefinition(
				goal_type=AgentGoal.EFFICIENCY_OPTIMIZATION,
				priority=GoalPriority.HIGH,
				description="Optimize team efficiency and workflow",
				target_value=0.85
			)
		],
		autonomy_level=0.5,
		collaboration_preference=0.95,
		creativity_factor=0.7,
		detail_orientation=0.8,
		specialization_domains=["project_management", "workflow_optimization", "team_dynamics"]
	),
	
	AgentRole.ANALYST: RoleDefinition(
		role=AgentRole.ANALYST,
		name="Data Analyst",
		description="Analyzes data and provides insights for proposal development",
		primary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.DATA_ANALYSIS,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.95,
				description="Expert data analysis and interpretation"
			),
			CapabilityDefinition(
				capability=AgentCapability.STATISTICAL_ANALYSIS,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.85,
				description="Statistical analysis and modeling"
			),
			CapabilityDefinition(
				capability=AgentCapability.TREND_ANALYSIS,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.8,
				description="Trend identification and forecasting"
			)
		],
		secondary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.FINANCIAL_ANALYSIS,
				level=CapabilityLevel.INTERMEDIATE,
				proficiency_score=0.7,
				description="Financial data analysis and insights"
			)
		],
		default_goals=[
			GoalDefinition(
				goal_type=AgentGoal.ACCURACY_IMPROVEMENT,
				priority=GoalPriority.CRITICAL,
				description="Maintain high accuracy in data analysis",
				target_value=0.95
			),
			GoalDefinition(
				goal_type=AgentGoal.COMPETITIVE_ADVANTAGE,
				priority=GoalPriority.HIGH,
				description="Provide insights for competitive advantage",
				target_value=0.8
			)
		],
		autonomy_level=0.8,
		collaboration_preference=0.7,
		creativity_factor=0.6,
		detail_orientation=0.9,
		specialization_domains=["data_science", "business_intelligence", "predictive_analytics"]
	),
	
	AgentRole.QUALITY_ASSURER: RoleDefinition(
		role=AgentRole.QUALITY_ASSURER,
		name="Quality Assurance Specialist",
		description="Ensures quality standards and voice consistency across all content",
		primary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.QUALITY_ASSURANCE,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.95,
				description="Expert quality assurance and validation"
			),
			CapabilityDefinition(
				capability=AgentCapability.VOICE_ANALYSIS,
				level=CapabilityLevel.EXPERT,
				proficiency_score=0.9,
				description="Voice consistency and brand alignment analysis"
			),
			CapabilityDefinition(
				capability=AgentCapability.STYLE_CHECKING,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.85,
				description="Style guide compliance and consistency"
			)
		],
		secondary_capabilities=[
			CapabilityDefinition(
				capability=AgentCapability.COMPLIANCE_REVIEW,
				level=CapabilityLevel.ADVANCED,
				proficiency_score=0.8,
				description="Regulatory and compliance validation"
			)
		],
		default_goals=[
			GoalDefinition(
				goal_type=AgentGoal.QUALITY_EXCELLENCE,
				priority=GoalPriority.CRITICAL,
				description="Maintain exceptional quality standards",
				target_value=0.98
			),
			GoalDefinition(
				goal_type=AgentGoal.CONTINUOUS_IMPROVEMENT,
				priority=GoalPriority.HIGH,
				description="Continuously improve quality processes",
				target_value=0.85
			)
		],
		autonomy_level=0.6,
		collaboration_preference=0.8,
		creativity_factor=0.3,
		detail_orientation=0.98,
		specialization_domains=["quality_management", "voice_dna", "compliance_standards"]
	)
}

def get_role_definition(role: AgentRole) -> RoleDefinition:
	"""Get the role definition for a specific agent role"""
	return ROLE_DEFINITIONS.get(role, RoleDefinition(
		role=role,
		name=role.value.replace('_', ' ').title(),
		description=f"Agent with {role.value} role"
	))

def get_capability_requirements(capability: AgentCapability) -> Dict[str, Any]:
	"""Get the requirements and dependencies for a specific capability"""
	# This would contain detailed capability requirements
	capability_requirements = {
		AgentCapability.WEB_RESEARCH: {
			"tools": ["web_scraper", "search_engine_api"],
			"skills": ["information_filtering", "source_validation"],
			"experience_threshold": 100
		},
		AgentCapability.CONTENT_CREATION: {
			"tools": ["text_editor", "grammar_checker", "style_analyzer"],
			"skills": ["writing", "editing", "storytelling"],
			"experience_threshold": 200
		},
		AgentCapability.DATA_ANALYSIS: {
			"tools": ["data_processor", "statistical_engine", "visualization"],
			"skills": ["statistics", "pattern_recognition", "interpretation"],
			"experience_threshold": 150
		}
	}
	
	return capability_requirements.get(capability, {
		"tools": [],
		"skills": [],
		"experience_threshold": 50
	})

def calculate_role_compatibility(agent_capabilities: List[CapabilityDefinition], 
								target_role: AgentRole) -> float:
	"""Calculate how well an agent's capabilities match a target role"""
	role_def = get_role_definition(target_role)
	
	# Get required capabilities
	required_caps = {cap.capability: cap.proficiency_score 
					for cap in role_def.primary_capabilities}
	secondary_caps = {cap.capability: cap.proficiency_score 
					 for cap in role_def.secondary_capabilities}
	
	# Calculate compatibility
	primary_score = 0.0
	secondary_score = 0.0
	
	agent_cap_map = {cap.capability: cap.proficiency_score 
					for cap in agent_capabilities}
	
	# Primary capabilities (weighted 70%)
	if required_caps:
		primary_matches = sum(
			min(agent_cap_map.get(cap, 0.0), target_score) 
			for cap, target_score in required_caps.items()
		)
		primary_score = primary_matches / len(required_caps)
	
	# Secondary capabilities (weighted 30%)
	if secondary_caps:
		secondary_matches = sum(
			min(agent_cap_map.get(cap, 0.0), target_score) 
			for cap, target_score in secondary_caps.items()
		)
		secondary_score = secondary_matches / len(secondary_caps)
	
	# Weighted combination
	compatibility = (primary_score * 0.7) + (secondary_score * 0.3)
	return min(1.0, compatibility)

def suggest_capability_improvements(current_capabilities: List[CapabilityDefinition], 
								   target_role: AgentRole) -> List[Dict[str, Any]]:
	"""Suggest capability improvements to better fit a target role"""
	role_def = get_role_definition(target_role)
	current_cap_map = {cap.capability: cap for cap in current_capabilities}
	
	suggestions = []
	
	# Check primary capabilities
	for required_cap in role_def.primary_capabilities:
		current_cap = current_cap_map.get(required_cap.capability)
		
		if not current_cap:
			suggestions.append({
				"type": "acquire",
				"capability": required_cap.capability,
				"target_level": required_cap.level,
				"priority": "high",
				"reason": "Required primary capability missing"
			})
		elif current_cap.proficiency_score < required_cap.proficiency_score:
			suggestions.append({
				"type": "improve",
				"capability": required_cap.capability,
				"current_score": current_cap.proficiency_score,
				"target_score": required_cap.proficiency_score,
				"priority": "medium",
				"reason": "Primary capability needs improvement"
			})
	
	# Check secondary capabilities
	for secondary_cap in role_def.secondary_capabilities:
		current_cap = current_cap_map.get(secondary_cap.capability)
		
		if not current_cap:
			suggestions.append({
				"type": "acquire",
				"capability": secondary_cap.capability,
				"target_level": secondary_cap.level,
				"priority": "low",
				"reason": "Beneficial secondary capability"
			})
	
	return suggestions